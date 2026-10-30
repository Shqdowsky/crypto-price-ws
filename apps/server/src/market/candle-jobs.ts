import { CANDLE_INTERVALS, CANDLE_RETENTION_SEC } from "@crypto-price-ws/shared";
import pool from "../config/db.js";

// Recomputes the previous bucket and the current (still open) bucket of `target`
// from `source` rows. The open bucket is overwritten each run until it closes.
async function rollup(target: number, source: number): Promise<void> {
	const bucketMs = target * 1000;
	const from = new Date(Math.floor(Date.now() / bucketMs) * bucketMs - bucketMs);
	await pool.query(
		`INSERT INTO price_candles (token, interval_sec, bucket_start, open, high, low, close)
		SELECT token, $1::int,
			date_bin(make_interval(secs => $1::int), bucket_start, TIMESTAMPTZ '1970-01-01 00:00:00+00') AS b,
			(array_agg(open ORDER BY bucket_start ASC))[1],
			max(high),
			min(low),
			(array_agg(close ORDER BY bucket_start DESC))[1]
		FROM price_candles
		WHERE interval_sec = $2::int AND bucket_start >= $3::timestamptz
		GROUP BY token, b
		ON CONFLICT (token, interval_sec, bucket_start) DO UPDATE
		SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close`,
		[target, source, from.toISOString()],
	);
}

let rollupTimer: NodeJS.Timeout | undefined;
let cleanupTimer: NodeJS.Timeout | undefined;
let rollupRunning = false;
let cleanupRunning = false;

// Order matters: 1m is built first (1s rows live only 30 min, but a 1h candle needs
// 60 min of source), then coarser intervals read the fresh 1m rows.
async function runRollups(): Promise<void> {
	if (rollupRunning) return;
	rollupRunning = true;
	try {
		await rollup(60, 1);
		await rollup(300, 60);
		await rollup(900, 60);
		await rollup(3600, 60);
	} catch (err) {
		console.error("[candle-jobs] rollup failed", err);
	} finally {
		rollupRunning = false;
	}
}

async function runCleanup(): Promise<void> {
	if (cleanupRunning) return;
	cleanupRunning = true;
	try {
		for (const interval of CANDLE_INTERVALS) {
			await pool.query(
				`DELETE FROM price_candles
				WHERE interval_sec = $1::int AND bucket_start < now() - make_interval(secs => $2::int)`,
				[interval, CANDLE_RETENTION_SEC[interval]],
			);
		}
	} catch (err) {
		console.error("[candle-jobs] cleanup failed", err);
	} finally {
		cleanupRunning = false;
	}
}

export function startCandleJobs(): void {
	if (rollupTimer) return;
	rollupTimer = setInterval(() => void runRollups(), 5_000);
	cleanupTimer = setInterval(() => void runCleanup(), 10 * 60_000);
	rollupTimer.unref();
	cleanupTimer.unref();
}

export function stopCandleJobs(): void {
	clearInterval(rollupTimer);
	clearInterval(cleanupTimer);
	rollupTimer = undefined;
	cleanupTimer = undefined;
}
