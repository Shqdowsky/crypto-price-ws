import httpserver from "./http/app.js";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./socket/middleware/auth.middleware.js";
import { setupSocketServer } from "./socket/index.js";
import { initTokenMap, startPriceLoop, stopPriceLoop } from "./market/price-store.js";
import {
	flush as flushCandles,
	recordTick,
	startCandleWriter,
	stopCandleWriter,
} from "./market/candle-writer.js";
import { startCandleJobs, stopCandleJobs } from "./market/candle-jobs.js";
import { closeCandleCache, warmCandleCache } from "./market/candle-cache.js";
import { SERVER_EVENTS } from "@crypto-price-ws/shared";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@crypto-price-ws/shared";
import { env } from "./config/env.js";
import { gracefulShutdown } from "./socket/utils/shutdown.js";
import pool from "./config/db.js";
import { pruneRateLimits } from "./socket/middleware/rate-limit.middleware.js";
import { initNotifier } from "./socket/notifier.js";
import { pruneLoginThrottle } from "./http/service/login-throttle.js";
import { startLoadStats } from "./monitoring/loadStats.js";

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpserver, {
	cors: {
		origin: env.CLIENT_URL,
		credentials: true,
	},
});

io.use(socketAuthMiddleware);

setupSocketServer(io);
initNotifier(io);

initTokenMap();
startPriceLoop((room, state) => {
	io.to(room).emit(SERVER_EVENTS.PRICE_UPDATE, {
		token: room,
		price: state.price,
		PDChange: state.PDChange,
		timestamp: state.updatedAt,
	});
	recordTick(room, state.price, state.updatedAt);
});
startCandleWriter();

void warmCandleCache().then(startCandleJobs);

setInterval(pruneRateLimits, 60_000).unref();
setInterval(pruneLoginThrottle, 60_000).unref();

// Opt-in during load tests: LOAD_STATS=1 logs event-loop lag and DB pool pressure every 5s.
if (process.env.LOAD_STATS === "1") startLoadStats(pool, () => io.engine.clientsCount);

async function stopCandles(): Promise<void> {
	stopPriceLoop();
	stopCandleWriter();
	stopCandleJobs();
	await flushCandles();
	await closeCandleCache();
}

httpserver.listen(env.WS_PORT, () => {
	console.log(`Server running on port ${env.WS_PORT}`);
});

process.on("SIGTERM", () =>
	gracefulShutdown("SIGTERM", io, httpserver, pool, stopCandles).catch(console.error),
);
process.on("SIGINT", () =>
	gracefulShutdown("SIGINT", io, httpserver, pool, stopCandles).catch(console.error),
);
