/*
 * Fills price_candles with real history from the Binance klines API, so the candles
 * endpoint (and the k6 candles test) has data to read before live candles accumulate.
 * Script implemented for local development and CI, not for production.
 */
import {
	CANDLE_INTERVALS,
	CANDLE_RETENTION_SEC,
	type CandleInterval,
	type RoomName,
} from "@crypto-price-ws/shared";
import pool from "../config/db.js";
import { SYMBOLS } from "../market/binance-source.js";

const BASE_URL = "https://api.binance.com/api/v3/klines";
const BINANCE_INTERVAL: Record<CandleInterval, string> = {
	1: "1s",
	60: "1m",
	300: "5m",
	900: "15m",
	3600: "1h",
};
const KLINES_PER_CALL = 1000;
const FETCH_TIMEOUT_MS = 10_000;
const CALL_PAUSE_MS = 150;

type Kline = [number, string, string, string, string, ...unknown[]];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWindow(
	token: RoomName,
	interval: CandleInterval,
	nowMs: number,
): Promise<Kline[]> {
	const step = interval * 1000;
	const lastClosed = Math.floor(nowMs / step) * step - step;
	let start = Math.floor((nowMs - CANDLE_RETENTION_SEC[interval] * 1000) / step) * step;
	const out: Kline[] = [];

	while (start <= lastClosed) {
		const url =
			`${BASE_URL}?symbol=${SYMBOLS[token].toUpperCase()}&interval=${BINANCE_INTERVAL[interval]}` +
			`&startTime=${start}&endTime=${lastClosed + step - 1}&limit=${KLINES_PER_CALL}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (!res.ok) throw new Error(`Binance klines HTTP ${res.status} for ${url}`);
		const batch = (await res.json()) as Kline[];
		out.push(...batch);
		if (batch.length < KLINES_PER_CALL) break;
		start = batch[batch.length - 1]![0] + step;
		await sleep(CALL_PAUSE_MS);
	}
	return out;
}

async function insert(token: RoomName, interval: CandleInterval, rows: Kline[]): Promise<number> {
	if (rows.length === 0) return 0;
	const res = await pool.query(
		`INSERT INTO price_candles (token, interval_sec, bucket_start, open, high, low, close)
		SELECT $1, $2::int, to_timestamp(t / 1000.0), o, h, l, c
		FROM unnest($3::bigint[], $4::float8[], $5::float8[], $6::float8[], $7::float8[])
			AS u(t, o, h, l, c)
		ON CONFLICT (token, interval_sec, bucket_start) DO NOTHING`,
		[
			token,
			interval,
			rows.map((k) => k[0]),
			rows.map((k) => Number(k[1])),
			rows.map((k) => Number(k[2])),
			rows.map((k) => Number(k[3])),
			rows.map((k) => Number(k[4])),
		],
	);
	return res.rowCount ?? 0;
}

async function main() {
	const nowMs = Date.now();
	for (const token of Object.keys(SYMBOLS) as RoomName[]) {
		for (const interval of CANDLE_INTERVALS) {
			const rows = await fetchWindow(token, interval, nowMs);
			const inserted = await insert(token, interval, rows);
			console.log(`${token} ${interval}s: fetched ${rows.length}, inserted ${inserted}`);
			await sleep(CALL_PAUSE_MS);
		}
	}
}

main()
	.catch((err) => {
		console.error("Seeding failed:", err);
		process.exitCode = 1;
	})
	.finally(() => void pool.end());
