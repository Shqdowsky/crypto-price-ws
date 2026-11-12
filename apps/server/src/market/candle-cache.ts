import { CANDLE_RETENTION_SEC, VALID_ROOMS, type CandleInterval } from "@crypto-price-ws/shared";
import { Redis } from "ioredis";
import { threadId } from "node:worker_threads";
import pool from "../config/db.js";
import { env } from "../config/env.js";

// 1s candles are rewritten every second and cover only 30 minutes: they stay in Postgres.
const CACHED_INTERVALS: readonly CandleInterval[] = [60, 300, 900, 3600];
const READY_TIMEOUT_MS = 5_000;

export const CLIENT_NAME = `candle-cache:${process.pid}:${threadId}`;

export interface CacheCandle {
	token: string;
	interval: number;
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
}

export interface PageQuery {
	token: string;
	interval: number;
	limit: number;
	before?: number | undefined;
	after?: number | undefined;
}

const keyOf = (token: string, interval: number) => `candles:${token}:${interval}`;
const isCached = (interval: number): interval is CandleInterval =>
	(CACHED_INTERVALS as readonly number[]).includes(interval);

export const timeOf = (member: string): number => Number(member.slice(8, member.indexOf(",")));

const serialize = (c: CacheCandle): string =>
	JSON.stringify({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close });

function createClient(url: string): Redis {
	const redis = new Redis(url, {
		connectionName: CLIENT_NAME,
		enableOfflineQueue: false,
		maxRetriesPerRequest: 1,
		connectTimeout: 5_000,
		...(url.startsWith("rediss://") && { tls: { rejectUnauthorized: false } }),
	});
	let lastLog = 0;
	redis.on("error", (err) => {
		if (Date.now() - lastLog < 30_000) return;
		lastLog = Date.now();
		console.error("[candle-cache] redis error:", err.message);
	});
	return redis;
}

const client = env.REDIS_URL ? createClient(env.REDIS_URL) : null;

client?.on("ready", () => void warmCandleCache());

const usable = (): Redis | null => (client?.status === "ready" ? client : null);

export function whenReady(timeoutMs: number): Promise<Redis | null> {
	if (!client) return Promise.resolve(null);
	if (client.status === "ready") return Promise.resolve(client);
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			client.off("ready", onReady);
			resolve(null);
		}, timeoutMs);
		const onReady = () => {
			clearTimeout(timer);
			resolve(client);
		};
		client.once("ready", onReady);
	});
}

export async function putCandles(candles: CacheCandle[]): Promise<void> {
	const redis = usable();
	const cacheable = candles.filter((c) => isCached(c.interval));
	if (!redis || cacheable.length === 0) return;
	try {
		const multi = redis.multi();
		const intervalByKey = new Map<string, CandleInterval>();
		for (const c of cacheable) {
			const key = keyOf(c.token, c.interval);
			intervalByKey.set(key, c.interval as CandleInterval);
			multi.zremrangebyscore(key, c.time, c.time);
			multi.zadd(key, c.time, serialize(c));
		}
		const now = Date.now();
		for (const [key, interval] of intervalByKey) {
			multi.zremrangebyscore(key, "-inf", now - CANDLE_RETENTION_SEC[interval] * 1000);
		}
		await multi.exec();
	} catch (err) {
		console.error("[candle-cache] put failed", err);
	}
}

export async function readPage(q: PageQuery): Promise<string[] | null> {
	const redis = usable();
	if (!redis || !isCached(q.interval)) return null;
	const key = keyOf(q.token, q.interval);
	try {
		if (q.after !== undefined) {
			const res = await redis
				.pipeline()
				.zrangebyscore(key, `(${q.after}`, "+inf", "LIMIT", 0, q.limit)
				.zrange(key, "0", "0")
				.exec();
			if (!res || res.some(([err]) => err)) return null;
			const page = res[0]![1] as string[];
			const oldest = (res[1]![1] as string[])[0];
			return oldest && q.after >= timeOf(oldest) ? page : null;
		}
		const upper = q.before === undefined ? "+inf" : `(${q.before}`;
		const page = await redis.zrevrangebyscore(key, upper, "-inf", "LIMIT", 0, q.limit);
		return page.length === q.limit ? page.reverse() : null;
	} catch (err) {
		console.error("[candle-cache] read failed", err);
		return null;
	}
}

let warming: Promise<void> | null = null;

/**
 * Rebuilds the cache from Postgres, so history that predates Redis (or was backfilled from
 * Binance) is cached too. Runs at startup and on every Redis (re)connect, so a Redis that was
 * started late or restarted refills itself. Replacing a key is one atomic MULTI, never a
 * half-filled key. Concurrent calls share one run. Never throws.
 *
 * A re-warm can overwrite a candle a rollup wrote after the Postgres snapshot was read. The
 * next rollup tick (5s) rewrites the previous and current buckets, so that heals itself.
 *
 * shortcut: a FLUSHALL on a connected Redis is not detected (no reconnect happens). Reads of a
 * cold key fall back to Postgres, so it is only a speed loss until the next restart or
 * reconnect. Upgrade by re-warming on a timer if someone flushes Redis while the app runs.
 */
export function warmCandleCache(): Promise<void> {
	warming ??= warm().finally(() => {
		warming = null;
	});
	return warming;
}

async function warm(): Promise<void> {
	const redis = await whenReady(READY_TIMEOUT_MS);
	if (!redis) {
		console.warn("[candle-cache] redis not ready, skipping warm-up");
		return;
	}
	try {
		for (const interval of CACHED_INTERVALS) {
			const { rows } = await pool.query<{
				token: string;
				bucket_start: Date;
				open: number;
				high: number;
				low: number;
				close: number;
			}>(
				`SELECT token, bucket_start, open, high, low, close FROM price_candles
				WHERE interval_sec = $1::int AND bucket_start >= now() - make_interval(secs => $2::int)
				ORDER BY bucket_start`,
				[interval, CANDLE_RETENTION_SEC[interval]],
			);
			const byToken = new Map<string, (string | number)[]>();
			for (const r of rows) {
				const args = byToken.get(r.token) ?? [];
				const time = r.bucket_start.getTime();
				args.push(time, serialize({ ...r, interval, time }));
				byToken.set(r.token, args);
			}
			const multi = redis.multi();
			for (const token of VALID_ROOMS) {
				const key = keyOf(token, interval);
				multi.del(key);
				const args = byToken.get(token);
				if (args) multi.zadd(key, ...args);
			}
			await multi.exec();
		}
		console.log("[candle-cache] warmed from Postgres");
	} catch (err) {
		console.error("[candle-cache] warm-up failed", err);
	}
}

export async function closeCandleCache(): Promise<void> {
	const redis = client;
	await redis?.quit().catch(() => redis.disconnect());
}
