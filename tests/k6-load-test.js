/*
 * k6 load test for the deployed app (socket.io over raw WebSocket, cookie auth).
 *
 *   k6 run -e BASE_URL=https://<your-app>.herokuapp.com tests/k6-load-test.js
 *
 * Env: BASE_URL (required) | PEAK=200 peak sockets | USERS=PEAK accounts to create
 *      HOLD=60s time at peak | SESSION_S=30 socket lifetime | ACTION_MS=1500 gap between actions
 *
 * setup() registers USERS throwaway accounts (k6load-*@example.com) on the target DB.
 * The server rate-limits PER USER (10 burst, 1/s), so keep USERS >= PEAK or the
 * rate_limited counter, not the server, becomes the limit you measure.
 */
import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "").replace(/\/+$/, "");
if (!BASE_URL) throw new Error("Set -e BASE_URL=https://<your-app>.herokuapp.com");

const WS_URL = `${BASE_URL.replace(/^http/, "ws")}/socket.io/?EIO=4&transport=websocket`;
const PEAK = Number(__ENV.PEAK || 200);
const USERS = Number(__ENV.USERS || PEAK);
const HOLD = __ENV.HOLD || "60s";
const SESSION_MS = Number(__ENV.SESSION_S || 30) * 1000;
const ACTION_MS = Number(__ENV.ACTION_MS || 1500);
const ACK_TIMEOUT_MS = 5000;
const PASSWORD = "LoadTest-1234";
const ROOMS = ["btc", "eth", "sol", "doge", "bnb", "xrp"];
const ACTIONS = [
	"account:get",
	"price:get",
	"buy",
	"trade:history:token",
	"sell",
	"position:history",
];

const connectOk = new Rate("connect_success");
const tradeOk = new Rate("trade_success");
const readOk = new Rate("read_success");
const connectTime = new Trend("connect_time_ms", true);
const tradeLatency = new Trend("trade_latency_ms", true);
const readLatency = new Trend("read_latency_ms", true);
// ~1000 when healthy. Tagged by token: a gap in every room = server stall, in a few = thin price feed.
const priceGap = new Trend("price_update_gap_ms", true);
// Error codes that get their own line in the summary; anything else is bucketed as OTHER and logged once.
const KNOWN_CODES = [
	"NO_OPEN_POSITION",
	"NO_PRICE_DATA",
	"PRICE_UNAVAILABLE",
	"INVALID_ROOM",
	"TRADE_FAILED",
	"SERVER_SHUTTING_DOWN",
	"ACCOUNT_STATE_FAILED",
	"TRADE_HISTORY_FAILED",
	"POSITION_HISTORY_FAILED",
	"OTHER",
];
// Strict gap limit only for btc; the other rooms are quiet on Binance, so they are reported but never fail the run.
const gapThresholds = {};
for (const r of ROOMS) {
	gapThresholds[`price_update_gap_ms{token:${r}}`] = [r === "btc" ? "p(99)<3000" : "p(99)<1000000"];
}
const codeThresholds = {};
for (const c of KNOWN_CODES) codeThresholds[`ack_errors{code:${c}}`] = ["count>=0"];
const priceUpdates = new Counter("price_updates");
const rateLimited = new Counter("rate_limited");
const ackTimeouts = new Counter("ack_timeouts");
const ackErrors = new Counter("ack_errors");
const authErrors = new Counter("auth_errors");
const connectFailures = new Counter("connect_failures"); // tagged by HTTP status of the failed upgrade
const RETRY_PAUSE_S = 2;
const unexpectedCloses = new Counter("unexpected_closes");

export const options = {
	setupTimeout: "300s",
	summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
	stages: [
		{ duration: "20s", target: Math.ceil(PEAK / 4) },
		{ duration: "20s", target: Math.ceil(PEAK / 2) },
		{ duration: "20s", target: PEAK },
		{ duration: HOLD, target: PEAK },
		{ duration: "15s", target: 0 },
	],
	thresholds: {
		// Abort early when the server clearly falls over, so we do not keep hammering production.
		connect_success: [{ threshold: "rate>0.9", abortOnFail: true, delayAbortEval: "30s" }],
		trade_success: ["rate>0.95"],
		read_success: ["rate>0.95"],
		connect_time_ms: ["p(95)<3000"],
		trade_latency_ms: ["p(95)<1500"],
		read_latency_ms: ["p(95)<1000"],
		...gapThresholds,
		...codeThresholds,
		ack_timeouts: ["count<20"],
	},
};

export function setup() {
	const runId = Date.now().toString(36);
	const users = [];
	for (let start = 0; start < USERS; start += 10) {
		const batch = [];
		for (let i = start; i < Math.min(start + 10, USERS); i++) {
			batch.push([
				"POST",
				`${BASE_URL}/auth/register`,
				JSON.stringify({
					username: `k6l${runId}${i}`,
					email: `k6load-${runId}-${i}@example.com`,
					password: PASSWORD,
				}),
				{ headers: { "Content-Type": "application/json" } },
			]);
		}
		for (const res of http.batch(batch)) {
			const token = res.status === 201 && res.cookies.token && res.cookies.token[0].value;
			if (token) users.push({ token });
		}
	}
	if (users.length === 0) throw new Error("Registration failed for every user, check BASE_URL");
	console.log(`registered ${users.length}/${USERS} users (run ${runId})`);
	return { users };
}

export default function (data) {
	const user = data.users[(__VU - 1) % data.users.length];
	const room = ROOMS[Math.floor(Math.random() * ROOMS.length)];
	const startedAt = Date.now();
	const pending = {}; // ack id -> { kind, sentAt }
	const lastPrice = {};
	const lastTickAt = {};
	let holding = false; // true only after a buy was confirmed, so sells never hit NO_OPEN_POSITION
	let connected = false;
	let decided = false;
	let closing = false;
	let ackId = 0;
	let step = 0;

	const decide = (ok) => {
		if (decided) return;
		decided = true;
		connectOk.add(ok);
	};

	let res;
	try {
		res = ws.connect(
			WS_URL,
			{ headers: { Cookie: `token=${user.token}`, Origin: BASE_URL } },
			(socket) => {
				const emit = (kind, event, payload) => {
					const id = ++ackId;
					const args = payload === undefined ? [event] : [event, payload];
					pending[id] = { kind, side: payload && payload.side, sentAt: Date.now() };
					socket.send(`42${id}${JSON.stringify(args)}`);
					socket.setTimeout(() => {
						if (!pending[id]) return;
						delete pending[id];
						ackTimeouts.add(1);
					}, ACK_TIMEOUT_MS);
				};

				const act = () => {
					const action = ACTIONS[step++ % ACTIONS.length];
					const price = lastPrice[room];
					switch (action) {
						case "buy":
							// ~$5 per buy so 1000 starting balance never runs out
							if (price && !holding) {
								const quantity = Number((5 / price).toFixed(8));
								emit("trade", "trade:execute", { token: room, side: "buy", quantity });
							}
							break;
						case "sell":
							if (holding) {
								emit("trade", "trade:execute", { token: room, side: "sell", quantity: "all" });
							}
							break;
						case "price:get":
							emit("read", action, room);
							break;
						case "account:get":
							emit("read", action);
							break;
						default:
							emit("read", action, { token: room });
					}
				};

				const onAck = (id, response) => {
					const entry = pending[id];
					if (!entry) return; // already timed out
					delete pending[id];
					const ok = response && response.success === true;
					const code = response && response.error && response.error.code;
					if (code === "RATE_LIMITED") {
						rateLimited.add(1);
						return; // not a server fault, keep out of the success rates
					}
					const latency = Date.now() - entry.sentAt;
					if (entry.kind === "trade") {
						tradeLatency.add(latency);
						tradeOk.add(ok);
					} else {
						readLatency.add(latency);
						readOk.add(ok);
					}
					if (ok && entry.side) holding = entry.side === "buy";
					if (!ok) {
						const known = KNOWN_CODES.includes(code);
						if (!known) console.warn(`unexpected ack error: ${JSON.stringify(response)}`);
						ackErrors.add(1, { code: known ? code : "OTHER" });
					}
				};

				const onEvent = (event, payload) => {
					if (event !== "price:update" && event !== "price:current") return;
					lastPrice[payload.token] = payload.price;
					if (event === "price:current") return;
					const now = Date.now();
					priceUpdates.add(1);
					if (lastTickAt[payload.token]) {
						priceGap.add(now - lastTickAt[payload.token], { token: payload.token });
					}
					lastTickAt[payload.token] = now;
				};

				socket.on("message", (raw) => {
					if (raw === "2") return socket.send("3"); // engine.io ping -> pong
					if (raw.startsWith("0")) return socket.send("40"); // engine.io open -> join namespace
					if (raw.startsWith("40")) {
						connected = true;
						decide(1);
						connectTime.add(Date.now() - startedAt);
						socket.setInterval(act, ACTION_MS);
						return;
					}
					if (raw.startsWith("44")) {
						// namespace connect error, i.e. the auth middleware rejected the cookie
						authErrors.add(1);
						decide(0);
						closing = true;
						return socket.close();
					}
					if (raw.startsWith("41")) return; // server disconnect, 'close' handler counts it
					const ack = /^43(\d+)(.*)$/s.exec(raw);
					const evt = /^42(\[.*)$/s.exec(raw);
					try {
						if (ack) onAck(Number(ack[1]), JSON.parse(ack[2])[0]);
						else if (evt) onEvent(...JSON.parse(evt[1]));
					} catch (e) {
						// malformed frame, ignore
					}
				});

				socket.on("error", () => decide(0));
				socket.on("close", () => {
					decide(0);
					if (connected && !closing) unexpectedCloses.add(1);
				});

				socket.setTimeout(() => {
					decide(0); // no namespace connect within 10s
					if (!connected) socket.close();
				}, 10000);
				socket.setTimeout(() => {
					closing = true;
					socket.close();
				}, SESSION_MS);
			},
		);
	} catch (e) {
		decide(0);
		connectFailures.add(1, { status: "exception" });
		sleep(RETRY_PAUSE_S + Math.random());
		return;
	}

	const upgraded = check(res, { "ws upgrade 101": (r) => r && r.status === 101 });
	if (!upgraded) {
		// A failed upgrade never runs the socket callback, so without this it is not counted at all.
		decide(0);
		connectFailures.add(1, { status: String(res && res.status) });
		// Pause so a failing VU does not hammer a struggling server with instant retries.
		sleep(RETRY_PAUSE_S + Math.random());
	}
}
