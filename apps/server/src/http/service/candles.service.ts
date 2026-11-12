import type { CandleInterval, CandlePage, RoomName } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";
import { env } from "../../config/env.js";
import { backfillGaps, findGaps } from "../../market/binance-klines.js";
import { putCandles, readPage, timeOf } from "../../market/candle-cache.js";

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

export async function getCandles(q: CandleQuery): Promise<string> {
	// With a simulated source backfillGaps does nothing, so there are no holes to check for.
	const mayBackfill = env.PRICE_SOURCE !== "simulated";

	const cached = await readPage(q);
	if (cached) {
		const holey =
			mayBackfill &&
			q.after === undefined &&
			findGaps(cached.map(timeOf), q.interval, q.limit, Date.now(), q.before).length > 0;
		if (!holey) return `{"candles":[${cached.join(",")}],"hasMore":${cached.length === q.limit}}`;
	}

	let rows = await queryRows(q);

	if (q.after === undefined) {
		const times = rows.map((r) => r.bucket_start.getTime());
		if (await backfillGaps(q.token as RoomName, q.interval, times, q.limit, q.before)) {
			rows = await queryRows(q);
			await putCandles(
				rows.map((r) => ({
					token: q.token,
					interval: q.interval,
					time: r.bucket_start.getTime(),
					open: r.open,
					high: r.high,
					low: r.low,
					close: r.close,
				})),
			);
		}
	}

	const page: CandlePage = {
		candles: rows.map((r) => ({
			time: r.bucket_start.getTime(),
			open: r.open,
			high: r.high,
			low: r.low,
			close: r.close,
		})),
		hasMore: rows.length === q.limit,
	};
	return JSON.stringify(page);
}
