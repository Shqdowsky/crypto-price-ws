import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import pool from "../../src/config/db.js";
import {
	CLIENT_NAME,
	closeCandleCache,
	putCandles,
	readPage,
	warmCandleCache,
	whenReady,
	type CacheCandle,
} from "../../src/market/candle-cache.js";

const TOKEN = `cachetest${Date.now()}`;
const STEP = 60_000;
const T0 = Math.floor(Date.now() / STEP) * STEP - 200 * STEP;
const KEY = `candles:${TOKEN}:60`;

const candle = (i: number, close = 100 + i, interval = 60): CacheCandle => ({
	token: TOKEN,
	interval,
	time: T0 + i * STEP,
	open: 100,
	high: 200,
	low: 50,
	close,
});
const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => candle(from + i));
const times = (page: string[] | null) => (page ?? []).map((m) => JSON.parse(m).time as number);

describe.skipIf(!env.REDIS_URL)("candle cache (real Redis)", () => {
	let raw: Redis;

	beforeAll(async () => {
		expect(await whenReady(5_000)).not.toBeNull();
		raw = new Redis(env.REDIS_URL!);
	});

	beforeEach(async () => {
		await raw.del(KEY, `candles:${TOKEN}:1`);
	});

	afterAll(async () => {
		await warmCandleCache();
		await raw.del(KEY, `candles:${TOKEN}:1`);
		raw.disconnect();
		await closeCandleCache();
		await pool.end();
	});

	it("returns the newest page in ascending order as the API's candle JSON", async () => {
		await putCandles(range(0, 129));
		const page = await readPage({ token: TOKEN, interval: 60, limit: 120 });
		expect(page).toHaveLength(120);
		expect(times(page)[0]).toBe(T0 + 10 * STEP);
		expect(times(page).at(-1)).toBe(T0 + 129 * STEP);
		expect(JSON.parse(page![119]!)).toEqual({
			time: T0 + 129 * STEP,
			open: 100,
			high: 200,
			low: 50,
			close: 229,
		});
	});

	it("replaces a changed candle instead of storing a second version", async () => {
		await putCandles(range(0, 129));
		await putCandles([candle(129, 999)]);
		expect(await raw.zcard(KEY)).toBe(130);
		const page = await readPage({ token: TOKEN, interval: 60, limit: 120 });
		expect(JSON.parse(page!.at(-1)!).close).toBe(999);
	});

	it("serves before pages with an exclusive cursor", async () => {
		await putCandles(range(0, 129));
		const page = await readPage({
			token: TOKEN,
			interval: 60,
			limit: 120,
			before: T0 + 129 * STEP,
		});
		expect(times(page)[0]).toBe(T0 + 9 * STEP);
		expect(times(page).at(-1)).toBe(T0 + 128 * STEP);
	});

	it("misses on a short page, which Postgres may hold more of", async () => {
		await putCandles(range(0, 49));
		expect(await readPage({ token: TOKEN, interval: 60, limit: 120 })).toBeNull();
		expect(
			await readPage({ token: TOKEN, interval: 60, limit: 120, before: T0 + 49 * STEP }),
		).toBeNull();
	});

	it("serves after pages from a cursor inside the cached window, even when short", async () => {
		await putCandles(range(0, 129));
		const page = await readPage({ token: TOKEN, interval: 60, limit: 120, after: T0 + 125 * STEP });
		expect(times(page)).toEqual([126, 127, 128, 129].map((i) => T0 + i * STEP));
		expect(
			await readPage({ token: TOKEN, interval: 60, limit: 120, after: T0 + 129 * STEP }),
		).toEqual([]);
	});

	it("misses on an after cursor older than the oldest cached candle", async () => {
		await putCandles(range(10, 129));
		expect(
			await readPage({ token: TOKEN, interval: 60, limit: 120, after: T0 + 5 * STEP }),
		).toBeNull();
		expect(
			await readPage({ token: TOKEN, interval: 60, limit: 120, after: T0 + 10 * STEP }),
		).not.toBeNull();
	});

	it("drops candles older than the interval's retention (26h for 1m)", async () => {
		const old = { ...candle(0), time: Date.now() - 27 * 3600_000 };
		await putCandles([old, ...range(0, 129)]);
		expect(await raw.zcard(KEY)).toBe(130);
	});

	it("ignores the 1s interval: it stays in Postgres", async () => {
		await putCandles([candle(0, 1, 1)]);
		expect(await raw.exists(`candles:${TOKEN}:1`)).toBe(0);
		expect(await readPage({ token: TOKEN, interval: 1, limit: 120 })).toBeNull();
	});

	describe("warm-up from Postgres", () => {
		// A real room, because the warm-up only rebuilds the keys of VALID_ROOMS. The bucket time has
		// an odd millisecond part, so it cannot collide with a real aligned candle in the test DB.
		const WARM_KEY = "candles:xrp:60";
		const warmTime = Date.now() - 5 * STEP - 1234;
		const warmBucket = new Date(warmTime);

		beforeEach(async () => {
			// Concurrent calls share one run. Let one started by the connect or a reconnect finish, so
			// the run a test starts reads Postgres after this test's row exists.
			await warmCandleCache();
			await pool.query(
				`INSERT INTO price_candles (token, interval_sec, bucket_start, open, high, low, close)
				VALUES ('xrp', 60, $1, 1, 3, 0.5, 123.5) ON CONFLICT DO NOTHING`,
				[warmBucket],
			);
			await raw.del(WARM_KEY);
		});

		afterEach(async () => {
			await pool.query(`DELETE FROM price_candles WHERE token = 'xrp' AND bucket_start = $1`, [
				warmBucket,
			]);
			await raw.del(WARM_KEY);
		});

		it("loads the stored candles into Redis", async () => {
			await warmCandleCache();
			const members = await raw.zrangebyscore(WARM_KEY, warmTime, warmTime);
			expect(members.map((m) => JSON.parse(m))).toEqual([
				{ time: warmTime, open: 1, high: 3, low: 0.5, close: 123.5 },
			]);
		});

		it("shares one run between concurrent calls", async () => {
			const logs: string[] = [];
			const spy = vi.spyOn(console, "log").mockImplementation((m: string) => void logs.push(m));
			await Promise.all([warmCandleCache(), warmCandleCache(), warmCandleCache()]);
			spy.mockRestore();
			expect(logs.filter((m) => m.includes("warmed from Postgres"))).toHaveLength(1);
		});

		it("refills by itself after the connection drops and comes back", async () => {
			// Drop only the module's own connection (found by its name), not other clients of this
			// Redis. ioredis reconnects by itself and emits "ready" again.
			const list = (await raw.client("LIST")) as string;
			const id = list
				.split("\n")
				.find((line) => line.includes(`name=${CLIENT_NAME} `))
				?.match(/\bid=(\d+)/)?.[1];
			expect(id).toBeDefined();
			await raw.client("KILL", "ID", id!);
			await vi.waitFor(async () => expect(await raw.zcard(WARM_KEY)).toBeGreaterThan(0), {
				timeout: 8_000,
				interval: 100,
			});
		});
	});
});
