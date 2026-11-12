import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import pool from "../../src/config/db.js";
import { getCandles } from "../../src/http/service/candles.service.js";
import {
	closeCandleCache,
	putCandles,
	warmCandleCache,
	whenReady,
} from "../../src/market/candle-cache.js";

// PRICE_SOURCE=simulated in .env.test, so backfillGaps never calls Binance here.
const TOKEN = `svctest${Date.now()}`;
const STEP = 60_000;
const T0 = Math.floor(Date.now() / STEP) * STEP - 200 * STEP;
const KEY = `candles:${TOKEN}:60`;
const COUNT = 130;
const at = (i: number) => T0 + i * STEP;
const parse = async (q: Parameters<typeof getCandles>[0]) => JSON.parse(await getCandles(q));
const base = { token: TOKEN, interval: 60 as const, limit: 120 };

let raw: Redis | undefined;

beforeAll(async () => {
	await pool.query(
		`INSERT INTO price_candles (token, interval_sec, bucket_start, open, high, low, close)
		SELECT $1, 60, to_timestamp(($2::bigint + g * 60000) / 1000.0), 100, 200, 50, 100 + g
		FROM generate_series(0, $3::int - 1) g`,
		[TOKEN, T0, COUNT],
	);
	if (env.REDIS_URL) {
		await whenReady(5_000);
		raw = new Redis(env.REDIS_URL);
	}
});

beforeEach(async () => {
	await raw?.del(KEY);
});

afterAll(async () => {
	await warmCandleCache();
	await pool.query(`DELETE FROM price_candles WHERE token = $1`, [TOKEN]);
	await raw?.del(KEY);
	raw?.disconnect();
	await closeCandleCache();
	await pool.end();
});

describe("getCandles from Postgres (cold or disabled cache)", () => {
	it("returns the newest page ascending with hasMore", async () => {
		const page = await parse(base);
		expect(page.candles).toHaveLength(120);
		expect(page.candles[0]).toEqual({ time: at(10), open: 100, high: 200, low: 50, close: 110 });
		expect(page.candles.at(-1).time).toBe(at(129));
		expect(page.hasMore).toBe(true);
	});

	it("returns a before page strictly older than the cursor, short at the start of history", async () => {
		const page = await parse({ ...base, before: at(10) });
		expect(page.candles.map((c: { time: number }) => c.time)).toEqual(
			Array.from({ length: 10 }, (_, i) => at(i)),
		);
		expect(page.hasMore).toBe(false);
	});

	it("returns an after page of the candles newer than the cursor", async () => {
		const page = await parse({ ...base, after: at(125) });
		expect(page.candles.map((c: { time: number }) => c.time)).toEqual([
			at(126),
			at(127),
			at(128),
			at(129),
		]);
	});
});

describe.skipIf(!env.REDIS_URL)("getCandles with a warm cache", () => {
	const cacheAll = async (closeOverride?: number) => {
		const { rows } = await pool.query(
			`SELECT bucket_start, open, high, low, close FROM price_candles
			WHERE token = $1 AND interval_sec = 60 ORDER BY bucket_start`,
			[TOKEN],
		);
		await putCandles(
			rows.map((r, i) => ({
				token: TOKEN,
				interval: 60,
				time: r.bucket_start.getTime(),
				open: r.open,
				high: r.high,
				low: r.low,
				close: i === rows.length - 1 && closeOverride !== undefined ? closeOverride : r.close,
			})),
		);
	};

	it("returns the same body as Postgres for latest, before and after pages", async () => {
		const queries = [base, { ...base, before: at(60) }, { ...base, after: at(100) }];
		const fromPg = await Promise.all(queries.map((q) => getCandles(q)));
		await cacheAll();
		expect(await raw!.zcard(KEY)).toBe(COUNT);
		const fromCache = await Promise.all(queries.map((q) => getCandles(q)));
		expect(fromCache).toEqual(fromPg);
	});

	it("serves from the cache when it holds the page", async () => {
		await cacheAll(999); // differs from Postgres, so only the cache can return 999
		const page = await parse(base);
		expect(page.candles.at(-1).close).toBe(999);
	});

	it("falls back to Postgres when the cache holds only part of the history", async () => {
		await putCandles([
			{ token: TOKEN, interval: 60, time: at(129), open: 1, high: 1, low: 1, close: 1 },
		]);
		const page = await parse({ ...base, after: at(100) });
		expect(page.candles).toHaveLength(29);
		expect(page.candles[0].close).toBe(201);
	});
});
