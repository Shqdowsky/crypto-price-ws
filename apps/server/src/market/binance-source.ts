import WebSocket from "ws";
import type { RoomName } from "@crypto-price-ws/shared";
import type { PriceSource } from "./price-source.js";

const BASE_URL = "wss://stream.binance.com:9443/stream";
const STREAM = "ticker_1d";

export const SYMBOLS: Record<RoomName, string> = {
	btc: "btcusdt",
	eth: "ethusdt",
	sol: "solusdt",
	doge: "dogeusdt",
	bnb: "bnbusdt",
	xrp: "xrpusdt",
};

const ROOM_BY_SYMBOL = new Map<string, RoomName>(
	(Object.entries(SYMBOLS) as [RoomName, string][]).map(([room, symbol]) => [
		symbol.toUpperCase(),
		room,
	]),
);

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const STALE_AFTER_MS = 10_000;
const SILENCE_LIMIT_MS = 15_000;
const WATCHDOG_INTERVAL_MS = 5_000;

export function parseTickerMessage(
	raw: string,
): { room: RoomName; price: number; PDChange: number } | null {
	let msg: unknown;
	try {
		msg = JSON.parse(raw);
	} catch {
		return null;
	}
	const data = (msg as { data?: { s?: unknown; c?: unknown; P?: unknown } } | null)?.data;
	if (typeof data?.s !== "string" || typeof data.c !== "string") return null;

	const room = ROOM_BY_SYMBOL.get(data.s);
	const price = Number(data.c);
	const PDChange = Number(data.P);
	if (!room || !Number.isFinite(price) || price <= 0) return null;
	return { room, price, PDChange };
}

export function createBinanceSource(): PriceSource {
	const streams = Object.values(SYMBOLS).map((s) => `${s}@${STREAM}`);
	const url = `${BASE_URL}?streams=${streams.join("/")}`;

	let socket: WebSocket | null = null;
	let stopped = true;
	let attempt = 0;
	let lastMessageAt = 0;
	let reconnectTimer: NodeJS.Timeout | null = null;
	let watchdog: NodeJS.Timeout | null = null;

	function scheduleReconnect(connect: () => void): void {
		if (stopped) return;
		const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
		attempt += 1;
		const jitter = Math.floor(Math.random() * 500);
		console.warn(`Binance feed disconnected, reconnecting in ${delay + jitter} ms`);
		reconnectTimer = setTimeout(connect, delay + jitter);
	}

	return {
		maxAgeMs: STALE_AFTER_MS,
		initialPrices: () => new Map(),

		start(onPrice) {
			stopped = false;

			const connect = () => {
				const ws = new WebSocket(url, { handshakeTimeout: 10_000 });
				socket = ws;
				lastMessageAt = Date.now();

				ws.on("open", () => {
					attempt = 0;
					console.log("Binance feed connected");
				});

				ws.on("message", (raw) => {
					lastMessageAt = Date.now();
					const parsed = parseTickerMessage(raw.toString());
					if (parsed) onPrice(parsed.room, parsed.price, parsed.PDChange);
				});

				ws.on("error", (err) => {
					if (socket === ws) socket = null;
					console.error("Binance feed error:", err.message);
				});
				ws.on("close", () => scheduleReconnect(connect));
			};

			connect();

			watchdog = setInterval(() => {
				if (socket && Date.now() - lastMessageAt > SILENCE_LIMIT_MS) {
					console.warn("Binance feed silent, restarting the connection");
					socket.terminate();
				}
			}, WATCHDOG_INTERVAL_MS);
		},

		stop() {
			stopped = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (watchdog) clearInterval(watchdog);
			reconnectTimer = null;
			watchdog = null;
			socket?.terminate();
			socket = null;
		},
	};
}
