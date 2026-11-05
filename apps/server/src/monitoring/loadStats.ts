import { monitorEventLoopDelay } from "node:perf_hooks";
import type { Pool } from "pg";

const RESOLUTION_MS = 10;
// The histogram records the full timer interval, so subtract the baseline to get the real lag.
const lagMs = (ns: number) =>
	Number.isFinite(ns) ? Math.max(0, Math.round(ns / 1e6) - RESOLUTION_MS) : 0;

/**
 * Logs one `[loadstats]` JSON line per window: event-loop lag and DB pool pressure.
 * Opt-in (see server.ts). Returns a stop function.
 */
export function startLoadStats(
	pool: Pick<Pool, "totalCount" | "idleCount" | "waitingCount">,
	getSockets: () => number,
	log: (line: string) => void = console.log,
	intervalMs = 5000,
): () => void {
	const loop = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
	loop.enable();

	// waitingCount is instantaneous, so sample often and keep the peak of the window.
	let waitingMax = 0;
	const sampler = setInterval(() => {
		waitingMax = Math.max(waitingMax, pool.waitingCount);
	}, 250);

	const reporter = setInterval(() => {
		waitingMax = Math.max(waitingMax, pool.waitingCount);
		log(
			`[loadstats] ${JSON.stringify({
				sockets: getSockets(),
				loop_mean_ms: lagMs(loop.mean),
				loop_p99_ms: lagMs(loop.percentile(99)),
				loop_max_ms: lagMs(loop.max),
				pool_total: pool.totalCount,
				pool_idle: pool.idleCount,
				pool_waiting_max: waitingMax,
			})}`,
		);
		loop.reset();
		waitingMax = 0;
	}, intervalMs);

	sampler.unref();
	reporter.unref();

	return () => {
		clearInterval(sampler);
		clearInterval(reporter);
		loop.disable();
	};
}
