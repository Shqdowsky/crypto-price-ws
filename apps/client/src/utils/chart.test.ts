import { describe, expect, it } from "vitest";
import type { Candle } from "@crypto-price-ws/shared";
import {
	applyTick,
	areaPath,
	bucketOf,
	linePath,
	nearestByTime,
	priceRange,
	timeForX,
	visibleSlice,
	xForTime,
} from "./chart";

const c = (time: number, close = 10, high = close, low = close): Candle => ({
	time,
	open: close,
	high,
	low,
	close,
});

describe("bucketOf", () => {
	it("floors to the interval start", () => {
		expect(bucketOf(61_500, 1)).toBe(61_000);
		expect(bucketOf(125_000, 60)).toBe(120_000);
	});
});

describe("applyTick", () => {
	it("updates high/low/close of the current bucket", () => {
		const out = applyTick([c(1000, 10)], 12, 1500, 1);
		expect(out).toEqual([{ time: 1000, open: 10, high: 12, low: 10, close: 12 }]);
		expect(applyTick(out, 8, 1900, 1)[0]).toMatchObject({ high: 12, low: 8, close: 8 });
	});

	it("appends a new candle for a later bucket", () => {
		const out = applyTick([c(1000, 10)], 11, 3200, 1);
		expect(out).toHaveLength(2);
		expect(out[1]).toEqual({ time: 3000, open: 11, high: 11, low: 11, close: 11 });
	});

	it("returns the same array for an earlier bucket", () => {
		const input = [c(5000)];
		expect(applyTick(input, 1, 1000, 1)).toBe(input);
	});

	it("starts a list from empty", () => {
		expect(applyTick([], 5, 2500, 1)).toEqual([c(2000, 5)]);
	});
});

describe("time/x conversion", () => {
	it("round-trips", () => {
		expect(xForTime(150, 100, 200, 400)).toBe(200);
		expect(timeForX(200, 100, 200, 400)).toBe(150);
	});
});

describe("visibleSlice", () => {
	const list = [1, 2, 3, 4, 5, 6].map((n) => c(n * 1000));
	it("includes one neighbour on each side", () => {
		expect(visibleSlice(list, 3000, 4000).map((x) => x.time)).toEqual([2000, 3000, 4000, 5000]);
	});
	it("clamps at the ends", () => {
		expect(visibleSlice(list, 0, 2000).map((x) => x.time)).toEqual([1000, 2000, 3000]);
	});
	it("returns the nearest candle when the view is past the data", () => {
		expect(visibleSlice(list, 9000, 10000).map((x) => x.time)).toEqual([6000]);
	});
});

describe("nearestByTime", () => {
	const list = [c(1000), c(2000), c(4000)];
	it("finds the closest candle", () => {
		expect(nearestByTime(list, 1400)).toBe(0);
		expect(nearestByTime(list, 1600)).toBe(1);
		expect(nearestByTime(list, 9000)).toBe(2);
	});
	it("returns null when empty", () => {
		expect(nearestByTime([], 1)).toBeNull();
	});
});

describe("priceRange", () => {
	it("pads low/high by 5%", () => {
		const r = priceRange([c(1, 100, 110, 90)]);
		expect(r.min).toBeCloseTo(89);
		expect(r.max).toBeCloseTo(111);
	});
});

describe("paths", () => {
	const base = {
		start: 0,
		end: 10_000,
		width: 100,
		height: 50,
		range: { min: 0, max: 20 },
		intervalSec: 1,
	};

	it("bridges consecutive candles", () => {
		const d = linePath({ ...base, candles: [c(1000), c(2000), c(3000)] });
		expect(d.match(/M/g)).toHaveLength(1);
	});

	it("breaks the line where candles are missing", () => {
		const d = linePath({ ...base, candles: [c(1000), c(2000), c(6000), c(7000)] });
		expect(d.match(/M/g)).toHaveLength(2);
		expect(
			areaPath({ ...base, candles: [c(1000), c(2000), c(6000), c(7000)] }).match(/Z/g),
		).toHaveLength(2);
	});
});
