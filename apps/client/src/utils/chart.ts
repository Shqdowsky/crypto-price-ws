import type { Candle } from "@crypto-price-ws/shared";

export interface PriceRange {
	min: number;
	max: number;
}

/** Start (epoch ms) of the bucket that contains `ts`. Matches the server's bucketing. */
export function bucketOf(ts: number, intervalSec: number): number {
	return Math.floor(ts / (intervalSec * 1000)) * intervalSec * 1000;
}

/** Folds a price tick into the candle list. Ticks older than the last bucket are ignored. */
export function applyTick(
	candles: Candle[],
	price: number,
	ts: number,
	intervalSec: number,
): Candle[] {
	const bucket = bucketOf(ts, intervalSec);
	const last = candles.at(-1);
	if (!last || bucket > last.time) {
		return [...candles, { time: bucket, open: price, high: price, low: price, close: price }];
	}
	if (bucket < last.time) return candles;
	return [
		...candles.slice(0, -1),
		{ ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price },
	];
}

/** X position of time `t` when the view spans [start, end] across `width` pixels. */
export function xForTime(t: number, start: number, end: number, width: number): number {
	return ((t - start) / (end - start || 1)) * width;
}

export function timeForX(x: number, start: number, end: number, width: number): number {
	return start + (x / (width || 1)) * (end - start);
}

/** Y position of a price inside the range; higher prices sit closer to the top. */
export function yForPrice(price: number, range: PriceRange, height: number): number {
	const span = range.max - range.min || 1;
	return height - ((price - range.min) / span) * height;
}

/** Candles inside [start, end] plus one neighbour on each side, so the line reaches the edges. */
export function visibleSlice(candles: Candle[], start: number, end: number): Candle[] {
	const firstIn = candles.findIndex((c) => c.time >= start);
	const from = Math.max(0, (firstIn === -1 ? candles.length : firstIn) - 1);
	const to = Math.min(candles.length - 1, candles.findLastIndex((c) => c.time <= end) + 1);
	return candles.slice(from, to + 1);
}

/** Index of the candle whose time is closest to `t` (binary search), or null when empty. */
export function nearestByTime(candles: Candle[], t: number): number | null {
	if (candles.length === 0) return null;
	let lo = 0;
	let hi = candles.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (candles[mid].time < t) lo = mid + 1;
		else hi = mid;
	}
	if (lo > 0 && t - candles[lo - 1].time <= candles[lo].time - t) return lo - 1;
	return lo;
}

/**
 * Y range for the candles' low/high, padded so the line never touches the top or bottom edge.
 * A flat series gets a small symmetric band instead of a zero-height range.
 */
export function priceRange(candles: Candle[], paddingRatio = 0.05): PriceRange {
	if (candles.length === 0) return { min: 0, max: 1 };

	let min = Infinity;
	let max = -Infinity;
	for (const c of candles) {
		if (c.low < min) min = c.low;
		if (c.high > max) max = c.high;
	}

	if (min === max) {
		const pad = min === 0 ? 1 : Math.abs(min) * paddingRatio;
		return { min: min - pad, max: max + pad };
	}

	const pad = (max - min) * paddingRatio;
	return { min: min - pad, max: max + pad };
}

/** Splits the series wherever candles are missing, so gaps are shown as breaks, not bridged. */
function segments(candles: Candle[], intervalSec: number): Candle[][] {
	const maxGap = 1.5 * intervalSec * 1000;
	const out: Candle[][] = [];
	let cur: Candle[] = [];
	for (const c of candles) {
		const prev = cur.at(-1);
		if (prev && c.time - prev.time > maxGap) {
			out.push(cur);
			cur = [];
		}
		cur.push(c);
	}
	if (cur.length > 0) out.push(cur);
	return out;
}

interface PathArgs {
	candles: Candle[];
	start: number;
	end: number;
	width: number;
	height: number;
	range: PriceRange;
	intervalSec: number;
}

function segmentPoints(seg: Candle[], a: PathArgs): [string, string][] {
	return seg.map((c) => [
		xForTime(c.time, a.start, a.end, a.width).toFixed(2),
		yForPrice(c.close, a.range, a.height).toFixed(2),
	]);
}

export function linePath(a: PathArgs): string {
	return segments(a.candles, a.intervalSec)
		.map((seg) => {
			const pts = segmentPoints(seg, a);
			// A lone candle gets a zero-length line so the round cap draws a dot.
			if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`;
			return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
		})
		.join(" ");
}

/** Each continuous run closed down to the baseline, used for the soft fill under the line. */
export function areaPath(a: PathArgs): string {
	return segments(a.candles, a.intervalSec)
		.filter((seg) => seg.length > 1)
		.map((seg) => {
			const pts = segmentPoints(seg, a);
			const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
			return `${line} L${pts.at(-1)![0]} ${a.height} L${pts[0][0]} ${a.height} Z`;
		})
		.join(" ");
}
