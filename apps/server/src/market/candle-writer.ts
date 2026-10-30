import pool from "../config/db.js";

interface SecondCandle {
	token: string;
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
}

// Ticks are folded into per-second OHLC in memory and written in one batch per
// flush: ~6 rows/s total instead of one INSERT per tick.
let buffer = new Map<string, SecondCandle>();
let timer: NodeJS.Timeout | undefined;
let running = false;

export function recordTick(token: string, price: number, timestampMs: number): void {
	const time = Math.floor(timestampMs / 1000) * 1000;
	const key = `${token}:${time}`;
	const c = buffer.get(key);
	if (!c) {
		buffer.set(key, { token, time, open: price, high: price, low: price, close: price });
		return;
	}
	c.high = Math.max(c.high, price);
	c.low = Math.min(c.low, price);
	c.close = price;
}

export async function flush(): Promise<void> {
	const batch = buffer;
	buffer = new Map();
	if (batch.size === 0) return;

	const rows = [...batch.values()];
	try {
		// open is not updated on conflict: if one second's ticks were split across two
		// flushes, the first flush already holds the true open.
		await pool.query(
			`INSERT INTO price_candles (token, interval_sec, bucket_start, open, high, low, close)
			SELECT t, 1, b, o, h, l, c
			FROM unnest($1::text[], $2::timestamptz[], $3::float8[], $4::float8[], $5::float8[], $6::float8[])
				AS u(t, b, o, h, l, c)
			ON CONFLICT (token, interval_sec, bucket_start) DO UPDATE SET
				high = GREATEST(price_candles.high, EXCLUDED.high),
				low = LEAST(price_candles.low, EXCLUDED.low),
				close = EXCLUDED.close`,
			[
				rows.map((r) => r.token),
				rows.map((r) => new Date(r.time).toISOString()),
				rows.map((r) => r.open),
				rows.map((r) => r.high),
				rows.map((r) => r.low),
				rows.map((r) => r.close),
			],
		);
	} catch (err) {
		// Gaps are accepted; retrying would grow the buffer unboundedly during a DB outage.
		console.error("[candle-writer] flush failed, batch dropped", err);
	}
}

export function startCandleWriter(): void {
	if (timer) return;
	timer = setInterval(() => {
		if (running) return; // never overlap flushes
		running = true;
		void flush().finally(() => {
			running = false;
		});
	}, 1000);
	timer.unref();
}

export function stopCandleWriter(): void {
	clearInterval(timer);
	timer = undefined;
}
