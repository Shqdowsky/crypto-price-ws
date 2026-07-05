import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const priceUpdatesReceived = new Counter("price_updates_received");
const tradeConfirmed = new Counter("trade_confirmed");
const connectionErrors = new Counter("connection_errors");
const rateLimitedCount = new Counter("rate_limited_count");
const serverErrors = new Counter("server_errors");

const connectionSuccessRate = new Rate("connection_success_rate");
const tradeSuccessRate = new Rate("trade_success_rate");

const priceUpdateLatency = new Trend("price_update_latency_ms", true);
const tradeLatency = new Trend("trade_latency_ms", true);

const BASE_URL = "";
const WS_URL = "";

const JWT_TOKEN = "";

const TOKENS = ["btc", "eth", "sol", "doge"];

export const options = {
stages: [
    { duration: '20s', target: 100  },
    { duration: '30s', target: 500  },
    { duration: '30s', target: 1000 },
    { duration: '45s', target: 1000 },
    { duration: '15s', target: 0    },
  ],
  thresholds: {
    connection_success_rate: ["rate>0.95"],
    trade_success_rate: ["rate>0.90"],
    price_update_latency_ms: ["p(95)<3000"],
    trade_latency_ms: ["p(95)<5000"],
    server_errors: ["count<50"],
  },
};

function randomToken() {
  return TOKENS[Math.floor(Math.random() * TOKENS.length)];
}

function send(socket, event, payload) {
  socket.send(JSON.stringify({ event, payload }));
}

export default function () {
  const token = randomToken();
  const joinedAt = Date.now();

  let priceUpdatesCount  = 0;
  let tradeConfirmedFlag = false;
  let tradeSentAt = null;
  let subscribeSentAt = null;

  const res = ws.connect(
    `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${JWT_TOKEN}`,
    {},
    function (socket) {
      connectionSuccessRate.add(1);

      let handshakeDone = false;

      socket.on("open", () => {
      });

      socket.on("message", (raw) => {
        console.log(`[msg received] ${raw}`);
        // ── socket.io packet parsing ──────────────────────────────────────
        // socket.io frames messages with a numeric prefix:
        //   0  = open (server hello)
        //   40 = connect (client confirms)
        //   42 = event (actual data)
        //   2  = ping, respond with 3 (pong)

        if (raw === "2") {
          socket.send("3");
          return;
        }

        if (raw.startsWith("0") && !handshakeDone) {
          socket.send("40");
          handshakeDone = true;
          return;
        }

        if (raw.startsWith("40") && handshakeDone) {
          subscribeSentAt = Date.now();
          socket.send(`42["subscribe","${token}"]`);
          console.log(`[sent] subscribe to ${token}`); 
          return;
        }

        if (!raw.startsWith("42")) return;

        let parsed;
        try {
          parsed = JSON.parse(raw.slice(2));
        } catch {
          return;
        }

        const [eventName, payload] = parsed;

        switch (eventName) {
          case "price:update": {
            priceUpdatesReceived.add(1);
            priceUpdatesCount++;

            if (priceUpdatesCount === 3 && !tradeSentAt) {
              tradeSentAt = Date.now();
              const side = Math.random() > 0.5 ? "buy" : "sell";
              socket.send(
                `42["trade:execute",${JSON.stringify({ token, side })}]`
              );
            }

            if (priceUpdatesCount >= 5) {
              socket.send('42["unsubscribe","' + token + '"]');
              socket.close();
            }
            break;
          }

          case "price:current": {
            priceUpdateLatency.add(Date.now() - subscribeSentAt);
            break;
          }

          case "trade:confirm": {
            tradeConfirmedFlag = true;
            tradeSuccessRate.add(1);
            tradeConfirmed.add(1);
            if (tradeSentAt) {
              tradeLatency.add(Date.now() - tradeSentAt);
            }
            break;
          }

          case "rate-limited": {
            rateLimitedCount.add(1);
            break;
          }

          case "error:general": {
            serverErrors.add(1);
            break;
          }

          case "server_shutdown": {
            socket.close();
            break;
          }
        }
      });

      socket.on("error", () => {
        connectionErrors.add(1);
        connectionSuccessRate.add(0);
      });

      socket.on("close", () => {
        if (tradeSentAt && !tradeConfirmedFlag) {
          tradeSuccessRate.add(0);
        }
      });

      socket.setTimeout(() => {
        socket.close();
      }, 20000);
    }
  );

  check(res, {
    "connected successfully": (r) => r && r.status === 101,
  });

  sleep(1);
}