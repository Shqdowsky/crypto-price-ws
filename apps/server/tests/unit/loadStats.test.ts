import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startLoadStats } from "../../src/monitoring/loadStats.js";

const parse = (line: string | undefined) => JSON.parse((line ?? "").replace("[loadstats] ", ""));

describe("startLoadStats", () => {
	const pool = { totalCount: 20, idleCount: 0, waitingCount: 0 };
	let lines: string[];

	beforeEach(() => {
		vi.useFakeTimers();
		lines = [];
		pool.waitingCount = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("logs the peak pool waiting count of the window, then resets it", () => {
		const stop = startLoadStats(
			pool,
			() => 42,
			(l) => lines.push(l),
			5000,
		);

		pool.waitingCount = 7;
		vi.advanceTimersByTime(250);
		pool.waitingCount = 0;
		vi.advanceTimersByTime(4750);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatch(/^\[loadstats\] /);
		expect(parse(lines[0])).toMatchObject({
			sockets: 42,
			pool_total: 20,
			pool_idle: 0,
			pool_waiting_max: 7,
		});

		vi.advanceTimersByTime(5000);
		expect(parse(lines[1]).pool_waiting_max).toBe(0);

		stop();
	});

	it("reports finite non-negative loop numbers even with no samples", () => {
		const stop = startLoadStats(
			pool,
			() => 0,
			(l) => lines.push(l),
			5000,
		);
		vi.advanceTimersByTime(5000);

		const out = parse(lines[0]);
		for (const k of ["loop_mean_ms", "loop_p99_ms", "loop_max_ms"]) {
			expect(Number.isFinite(out[k])).toBe(true);
			expect(out[k]).toBeGreaterThanOrEqual(0);
		}
		stop();
	});

	it("stops logging after stop()", () => {
		const stop = startLoadStats(
			pool,
			() => 0,
			(l) => lines.push(l),
			5000,
		);
		stop();
		vi.advanceTimersByTime(20_000);
		expect(lines).toHaveLength(0);
	});
});
