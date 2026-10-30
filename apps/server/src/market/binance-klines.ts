import type { CandleInterval, RoomName } from "@crypto-price-ws/shared";
import pool from "../config/db.js";
import { env } from "../config/env.js";
import { SYMBOLS } from "./binance-source.js";

const BASE_URL = "https://api.binance.com/api/v3/klines";
const BINANCE_INTERVAL: Record<CandleInterval, string> = {
	1: "1s",
	60: "1m",
	300: "5m",
	900: "15m",
	3600: "1h",
};
const KLINES_PER_CALL = 1000; // Binance maximum
const MAX_CALLS = 3; // per request: bounds latency and Binance rate-limit weight
const FETCH_TIMEOUT_MS = 3_000;
const MIN_GAP_MS = 60_000;

export interface GapRange {
	from: number; // first missing bucket start, epoch ms
	to: number; // last missing bucket start, epoch ms
}

// Finds missing bucket ranges in an ascending page of candle times. A gap is two
// neighbours more than max(interval, 60s) apart, or a newest candle that far behind
// "now". The still-open current bucket is excluded: live ticks build it.
export function findGaps(
	times: number[],
	interval: CandleInterval,
	limit: number,
	nowMs: number,
): GapRange[] {
	const step = interval * 1000;
	const threshold = Math.max(step, MIN_GAP_MS);
	const currentBucket = Math.floor(nowMs / step) * step;
	const gaps: GapRange[] = [];

	if (times.length === 0) return [{ from: currentBucket - limit * step, to: currentBucket - step }];

	for (let i = 1; i < times.length; i++) {
		const prev = times[i - 1]!;
		const next = times[i]!;
		if (next - prev > threshold) gaps.push({ from: prev + step, to: next - step });
	}
	const last = times[times.length - 1]!;
	if (nowMs - last > threshold && last + step <= currentBucket - step) {
		gaps.push({ from: last + step, to: currentBucket - step });
	}
	return gaps;
}

type Kline = [number, string, string, string, string, ...unknown[]];

async function fetchKlines(
	token: RoomName,
	interval: CandleInterval,
	gap: GapRange,
	calls: number,
) {
	const out: Kline[] = [];
	const step = interval * 1000;
	let start = gap.from;
	let used = 0;
	while (start <= gap.to && used < calls) {
		const url =
			`${BASE_URL}?symbol=${SYMBOLS[token].toUpperCase()}&interval=${BINANCE_INTERVAL[interval]}` +
			`&startTime=${start}&endTime=${gap.to + step - 1}&limit=${KLINES_PER_CALL}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (!res.ok) throw new Error(`Binance klines HTTP ${res.status}`);
		const batch = (await res.json()) as Kline[];
		used++;
		out.push(...batch);
		if (batch.length < KLINES_PER_CALL) break;
		start = batch[batch.length - 1]![0] + step;
	}
	return { klines: out, used };
}

// One Binance fetch per token:interval at a time, so N users opening the same chart
// share a single request instead of sending N.
const inFlight = new Map<string, Promise<boolean>>();

/** Fills gaps in the page from Binance. Resolves true if rows were inserted. Never throws. */
export function backfillGaps(
	token: RoomName,
	interval: CandleInterval,
	times: number[],
	limit: number,
): Promise<boolean> {
	// Simulated prices must not be mixed with real Binance history.
	if (env.PRICE_SOURCE === "simulated") return Promise.resolve(false);

	const key = `${token}:${interval}`;
	const existing = inFlight.get(key);
	if (existing) return existing;

	const run = (async () => {
		try {
			const gaps = findGaps(times, interval, limit, Date.now());
			let budget = MAX_CALLS;
			const rows: Kline[] = [];
			for (const gap of gaps) {
				if (budget <= 0) break;
				const { klines, used } = await fetchKlines(token, interval, gap, budget);
				budget -= used;
				rows.push(...klines);
			}
			if (rows.length === 0) return false;

			// DO NOTHING: only fill holes, never overwrite rows the live writer produced.
			await pool.query(
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
			return true;
		} catch (err) {
			// Serve what the DB has; a Binance outage must not break the endpoint.
			console.error("[binance-klines] backfill failed", err);
			return false;
		}
	})();
	inFlight.set(key, run);
	// Cleanup runs after set() (microtask), even when run resolved without awaiting.
	void run.finally(() => inFlight.delete(key));
	return run;
}
