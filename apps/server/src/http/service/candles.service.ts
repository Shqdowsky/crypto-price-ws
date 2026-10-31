import type { CandleInterval, CandlePage, RoomName } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";
import { backfillGaps } from "../../market/binance-klines.js";

interface CandleQuery {
	token: string;
	interval: CandleInterval;
	limit: number;
	before?: number | undefined;
	after?: number | undefined;
}

interface Row {
	bucket_start: Date;
	open: number;
	high: number;
	low: number;
	close: number;
}

// Keyset pagination on bucket_start (never OFFSET): new rows arrive every second, so
// an offset would shift between requests. Strict < / > keeps pages from overlapping.
async function queryRows(q: CandleQuery): Promise<Row[]> {
	const { token, interval, limit, before, after } = q;
	const cols = "SELECT bucket_start, open, high, low, close FROM price_candles";

	if (after !== undefined) {
		const { rows } = await pool.query<Row>(
			`${cols} WHERE token = $1 AND interval_sec = $2 AND bucket_start > $3
			ORDER BY bucket_start ASC LIMIT $4`,
			[token, interval, new Date(after), limit],
		);
		return rows;
	}
	const params: unknown[] = [token, interval, limit];
	if (before !== undefined) params.push(new Date(before));
	const { rows } = await pool.query<Row>(
		`${cols} WHERE token = $1 AND interval_sec = $2${before !== undefined ? " AND bucket_start < $4" : ""}
		ORDER BY bucket_start DESC LIMIT $3`,
		params,
	);
	return rows.reverse();
}

export async function getCandles(q: CandleQuery): Promise<CandlePage> {
	let rows = await queryRows(q);

	// Latest page and scroll-back pages: fill holes from Binance, then re-read so the client
	// gets one consistent page. Older pages need it too, or holes outside the first window
	// would never be filled. The live `after` refresh is skipped: ticks build those buckets.
	if (q.after === undefined) {
		const times = rows.map((r) => r.bucket_start.getTime());
		if (await backfillGaps(q.token as RoomName, q.interval, times, q.limit, q.before)) {
			rows = await queryRows(q);
		}
	}

	return {
		candles: rows.map((r) => ({
			time: r.bucket_start.getTime(),
			open: r.open,
			high: r.high,
			low: r.low,
			close: r.close,
		})),
		hasMore: rows.length === q.limit,
	};
}
