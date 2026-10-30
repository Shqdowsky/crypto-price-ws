import { describe, expect, it } from "vitest";
import { CANDLE_WINDOW_MAX, type Candle } from "@crypto-price-ws/shared";
import { initialWindowState, windowReducer, type WindowState } from "./useCandleWindow";

const c = (time: number, close = 10): Candle => ({
	time,
	open: close,
	high: close,
	low: close,
	close,
});
const run = (from: number, n: number) => Array.from({ length: n }, (_, i) => c((from + i) * 1000));
const ready = (candles: Candle[], extra: Partial<WindowState> = {}): WindowState => ({
	...initialWindowState,
	status: "ready",
	candles,
	...extra,
});

describe("windowReducer", () => {
	it("init replays buffered ticks onto the page and follows live", () => {
		const s = windowReducer(initialWindowState, {
			type: "init",
			page: { candles: run(0, 3), hasMore: true },
			ticks: [
				{ price: 20, timestamp: 2500 },
				{ price: 30, timestamp: 3100 },
			],
			intervalSec: 1,
		});
		expect(s.status).toBe("ready");
		expect(s.hasOlder).toBe(true);
		expect(s.hasNewer).toBe(false);
		expect(s.following).toBe(true);
		expect(s.candles.map((x) => x.time)).toEqual([0, 1000, 2000, 3000]);
		expect(s.candles[2]).toMatchObject({ high: 20, close: 20 });
	});

	it("olderDone prepends without duplicates", () => {
		const s = windowReducer(ready(run(10, 5)), {
			type: "olderDone",
			page: { candles: run(5, 6), hasMore: false },
		});
		expect(s.candles.map((x) => x.time / 1000)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
		expect(s.hasOlder).toBe(false);
	});

	it("olderDone over the cap drops the newest end and detaches from live", () => {
		const s = windowReducer(ready(run(1000, 300)), {
			type: "olderDone",
			page: { candles: run(880, 120), hasMore: true },
		});
		expect(s.candles).toHaveLength(CANDLE_WINDOW_MAX);
		expect(s.candles[0].time).toBe(880_000);
		expect(s.hasNewer).toBe(true);
		expect(s.following).toBe(false);
	});

	it("newerDone over the cap drops the oldest end", () => {
		const s = windowReducer(ready(run(0, 300), { hasNewer: true, following: false }), {
			type: "newerDone",
			page: { candles: run(299, 120), hasMore: true },
			ticks: [],
			intervalSec: 1,
		});
		expect(s.candles).toHaveLength(CANDLE_WINDOW_MAX);
		expect(s.candles.at(-1)?.time).toBe(418_000);
		expect(s.hasOlder).toBe(true);
		expect(s.hasNewer).toBe(true);
	});

	it("newerDone at the end replays ticks and resumes following", () => {
		const s = windowReducer(ready(run(0, 3), { hasNewer: true, following: false }), {
			type: "newerDone",
			page: { candles: run(2, 2), hasMore: false },
			ticks: [{ price: 99, timestamp: 3200 }],
			intervalSec: 1,
		});
		expect(s.candles.map((x) => x.time)).toEqual([0, 1000, 2000, 3000]);
		expect(s.candles.at(-1)?.close).toBe(99);
		expect(s.hasNewer).toBe(false);
		expect(s.following).toBe(true);
	});

	it("tick applies only while the window holds the live edge", () => {
		const live = windowReducer(ready(run(0, 2)), {
			type: "tick",
			price: 5,
			ts: 2100,
			intervalSec: 1,
		});
		expect(live.candles).toHaveLength(3);

		// Option A: detaching the view (following=false) does not stop ticks.
		const detached = windowReducer(ready(run(0, 2), { following: false }), {
			type: "tick",
			price: 5,
			ts: 2100,
			intervalSec: 1,
		});
		expect(detached.candles).toHaveLength(3);

		const behind = ready(run(0, 2), { hasNewer: true });
		expect(windowReducer(behind, { type: "tick", price: 5, ts: 2100, intervalSec: 1 })).toBe(
			behind,
		);
	});

	it("tick trims the oldest candle past the cap, except while older candles load", () => {
		const full = ready(run(0, CANDLE_WINDOW_MAX));
		const tick = { type: "tick", price: 5, ts: CANDLE_WINDOW_MAX * 1000, intervalSec: 1 } as const;
		const trimmed = windowReducer(full, tick);
		expect(trimmed.candles).toHaveLength(CANDLE_WINDOW_MAX);
		expect(trimmed.candles[0].time).toBe(1000);
		expect(trimmed.hasOlder).toBe(true);

		const loading = windowReducer({ ...full, loadingOlder: true }, tick);
		expect(loading.candles).toHaveLength(CANDLE_WINDOW_MAX + 1);
	});

	it("failed loads keep the window and clear the loading flag", () => {
		const s = ready(run(0, 3), { loadingOlder: true, loadingNewer: true });
		expect(windowReducer(s, { type: "olderFail" })).toMatchObject({
			candles: s.candles,
			loadingOlder: false,
		});
		expect(windowReducer(s, { type: "newerFail" })).toMatchObject({
			candles: s.candles,
			loadingNewer: false,
		});
	});
});
