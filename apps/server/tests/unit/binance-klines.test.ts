import { describe, expect, it } from "vitest";
import { findGaps } from "../../src/market/binance-klines.js";

const MIN = 60_000;
// Aligned to 1h so every interval's bucket boundaries line up.
const NOW = Date.UTC(2026, 0, 1, 12, 0, 30);

describe("findGaps", () => {
	it("returns no gaps for contiguous 1m candles up to the previous minute", () => {
		const times = [
			NOW - 4 * MIN - 30_000,
			NOW - 3 * MIN - 30_000,
			NOW - 2 * MIN - 30_000,
			NOW - MIN - 30_000,
		].map((t) => Math.floor(t / MIN) * MIN);
		expect(findGaps(times, 60, 120, NOW)).toEqual([]);
	});

	it("reports the missing 1m buckets between two candles", () => {
		const a = Date.UTC(2026, 0, 1, 11, 50);
		const b = Date.UTC(2026, 0, 1, 11, 55);
		const gaps = findGaps([a, b], 60, 120, NOW);
		expect(gaps[0]).toEqual({ from: a + MIN, to: b - MIN });
	});

	it("ignores 1s gaps of 60s or less", () => {
		const t = Date.UTC(2026, 0, 1, 11, 59);
		expect(findGaps([t, t + 30_000], 1, 120, t + 31_000)).toEqual([]);
	});

	it("reports 1s gaps longer than 60s", () => {
		const t = Date.UTC(2026, 0, 1, 11, 0, 0);
		const gaps = findGaps([t, t + 120_000], 1, 120, t + 121_000);
		expect(gaps).toEqual([{ from: t + 1000, to: t + 119_000 }]);
	});

	it("reports a trailing gap up to the previous closed bucket, excluding the open one", () => {
		const last = Date.UTC(2026, 0, 1, 11, 40);
		const gaps = findGaps([last], 60, 120, NOW);
		expect(gaps).toEqual([{ from: last + MIN, to: Date.UTC(2026, 0, 1, 11, 59) }]);
	});

	it("reports a missing 1h candle", () => {
		const a = Date.UTC(2026, 0, 1, 6);
		const b = Date.UTC(2026, 0, 1, 8);
		const gaps = findGaps([a, b], 3600, 120, NOW);
		expect(gaps[0]).toEqual({ from: a + 3_600_000, to: b - 3_600_000 });
	});

	it("clamps a long trailing 1s gap to the newest `limit` buckets", () => {
		const last = NOW - 3 * 3_600_000;
		const current = Date.UTC(2026, 0, 1, 12, 0, 30);
		expect(findGaps([last], 1, 120, NOW)).toEqual([
			{ from: current - 120_000, to: current - 1000 },
		]);
	});

	it("keeps gaps between rows even when older than `limit` buckets from now", () => {
		const a = Date.UTC(2026, 0, 1, 6, 0);
		const b = Date.UTC(2026, 0, 1, 6, 10);
		expect(findGaps([a, b], 60, 120, NOW)).toEqual([
			{ from: a + MIN, to: b - MIN },
			{ from: Date.UTC(2026, 0, 1, 10, 0), to: Date.UTC(2026, 0, 1, 11, 59) },
		]);
	});

	describe("older page (before cursor)", () => {
		const before = Date.UTC(2026, 0, 1, 9, 0);

		it("finds holes between rows", () => {
			const a = Date.UTC(2026, 0, 1, 8, 0);
			const b = Date.UTC(2026, 0, 1, 8, 30);
			const last = before - MIN;
			expect(findGaps([a, b, last], 60, 120, NOW, before)).toEqual([
				{ from: a + MIN, to: b - MIN },
				{ from: b + MIN, to: last - MIN },
			]);
		});

		it("finds the hole between the newest row and the cursor, not up to now", () => {
			const last = Date.UTC(2026, 0, 1, 8, 20);
			expect(findGaps([last], 60, 120, NOW, before)).toEqual([
				{ from: last + MIN, to: before - MIN },
			]);
		});

		it("returns nothing for an empty page", () => {
			expect(findGaps([], 60, 120, NOW, before)).toEqual([]);
		});
	});

	it("fills the latest `limit` closed candles when the page is empty", () => {
		const current = Date.UTC(2026, 0, 1, 12, 0);
		expect(findGaps([], 60, 10, NOW)).toEqual([{ from: current - 10 * MIN, to: current - MIN }]);
	});
});
