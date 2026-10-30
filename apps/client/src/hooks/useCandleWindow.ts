import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
	CANDLE_PAGE_SIZE,
	CANDLE_WINDOW_MAX,
	type Candle,
	type CandlePage,
	type RoomName,
} from "@crypto-price-ws/shared";
import { env } from "../config/env";
import { useSocketContext } from "../context/socket/SocketProvider";
import type { PricePoint } from "../context/socket/socketReducer";
import { applyTick } from "../utils/chart";
import { authFetch } from "../utils/authFetch";

export interface WindowState {
	candles: Candle[]; // ≤ CANDLE_WINDOW_MAX, ascending, contiguous
	hasOlder: boolean;
	hasNewer: boolean; // false means the window ends at the live edge
	following: boolean;
	loadingOlder: boolean;
	loadingNewer: boolean;
	status: "loading" | "ready" | "error";
}

export const initialWindowState: WindowState = {
	candles: [],
	hasOlder: false,
	hasNewer: false,
	following: true,
	loadingOlder: false,
	loadingNewer: false,
	status: "loading",
};

export type WindowAction =
	| { type: "reset" }
	| { type: "init"; page: CandlePage; ticks: PricePoint[]; intervalSec: number }
	| { type: "error" }
	| { type: "olderStart" }
	| { type: "olderDone"; page: CandlePage }
	| { type: "olderFail" }
	| { type: "newerStart" }
	| { type: "newerDone"; page: CandlePage; ticks: PricePoint[]; intervalSec: number }
	| { type: "newerFail" }
	| { type: "tick"; price: number; ts: number; intervalSec: number }
	| { type: "follow"; value: boolean };

function replay(candles: Candle[], ticks: PricePoint[], intervalSec: number): Candle[] {
	return ticks.reduce((acc, t) => applyTick(acc, t.price, t.timestamp, intervalSec), candles);
}

export function windowReducer(s: WindowState, a: WindowAction): WindowState {
	switch (a.type) {
		case "reset":
			return initialWindowState;

		case "init":
			return {
				...initialWindowState,
				status: "ready",
				candles: replay(a.page.candles, a.ticks, a.intervalSec),
				hasOlder: a.page.hasMore,
			};

		case "error":
			return { ...s, status: "error" };

		case "olderStart":
			return { ...s, loadingOlder: true };

		case "olderFail":
			return { ...s, loadingOlder: false };

		case "olderDone": {
			const first = s.candles[0]?.time ?? Infinity;
			const merged = [...a.page.candles.filter((c) => c.time < first), ...s.candles];
			const next = { ...s, loadingOlder: false, hasOlder: a.page.hasMore };
			if (merged.length <= CANDLE_WINDOW_MAX) return { ...next, candles: merged };
			// Drop from the newest end; the live edge is no longer in memory.
			return {
				...next,
				candles: merged.slice(0, CANDLE_WINDOW_MAX),
				hasNewer: true,
				following: false,
			};
		}

		case "newerStart":
			return { ...s, loadingNewer: true };

		case "newerFail":
			return { ...s, loadingNewer: false };

		case "newerDone": {
			// The cursor re-fetches the last candle (it may have been an open bucket), so the
			// page replaces any candle at or after its first time.
			const from = a.page.candles[0]?.time ?? Infinity;
			let merged = [...s.candles.filter((c) => c.time < from), ...a.page.candles];
			const trimmed = merged.length > CANDLE_WINDOW_MAX;
			if (trimmed) merged = merged.slice(-CANDLE_WINDOW_MAX);
			const next = { ...s, loadingNewer: false, hasOlder: s.hasOlder || trimmed };
			if (a.page.hasMore) return { ...next, candles: merged, hasNewer: true };
			return {
				...next,
				candles: replay(merged, a.ticks, a.intervalSec),
				hasNewer: false,
				following: true,
			};
		}

		case "tick": {
			// The window holds the live edge only while hasNewer is false.
			if (s.status !== "ready" || s.hasNewer) return s;
			const candles = applyTick(s.candles, a.price, a.ts, a.intervalSec);
			if (candles === s.candles) return s;
			// While older candles load, trimming would open a gap at the fetch cursor.
			if (candles.length > CANDLE_WINDOW_MAX && !s.loadingOlder) {
				return { ...s, candles: candles.slice(-CANDLE_WINDOW_MAX), hasOlder: true };
			}
			return { ...s, candles };
		}

		case "follow":
			return { ...s, following: a.value };
	}
}

async function fetchPage(
	token: RoomName,
	intervalSec: number,
	signal: AbortSignal,
	cursor?: { before: number } | { after: number },
): Promise<CandlePage> {
	const q = new URLSearchParams({ interval: String(intervalSec), limit: String(CANDLE_PAGE_SIZE) });
	if (cursor) for (const [k, v] of Object.entries(cursor)) q.set(k, String(v));
	const res = await authFetch(`${env.VITE_SERVER_URL}/candles/${token}?${q}`, { signal });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? `Request failed (${res.status})`);
	}
	return (await res.json()) as CandlePage;
}

export function useCandleWindow(token: RoomName, intervalSec: number) {
	const { state: socket } = useSocketContext();
	const [state, dispatch] = useReducer(windowReducer, initialWindowState);
	const [attempt, setAttempt] = useState(0);

	const stateRef = useRef(state);
	const ticksRef = useRef<PricePoint[]>([]);
	const ctrlRef = useRef<AbortController | null>(null);
	const inflight = useRef({ older: false, newer: false });

	const payload = socket.prices[token];
	const history = socket.priceHistory[token];

	useEffect(() => {
		stateRef.current = state;
		ticksRef.current = history ?? [];
	});

	// Initial load. Cleanup aborts in-flight requests, so stale responses are dropped.
	useEffect(() => {
		const ctrl = new AbortController();
		ctrlRef.current = ctrl;
		inflight.current = { older: false, newer: false };
		fetchPage(token, intervalSec, ctrl.signal)
			.then((page) => {
				if (!ctrl.signal.aborted) {
					dispatch({ type: "init", page, ticks: ticksRef.current, intervalSec });
				}
			})
			.catch(() => {
				if (!ctrl.signal.aborted) dispatch({ type: "error" });
			});
		return () => ctrl.abort();
	}, [token, intervalSec, attempt]);

	useEffect(() => {
		if (payload)
			dispatch({ type: "tick", price: payload.price, ts: payload.timestamp, intervalSec });
	}, [payload, intervalSec]);

	const load = useCallback(
		async (dir: "older" | "newer") => {
			const s = stateRef.current;
			const ctrl = ctrlRef.current;
			const edge = dir === "older" ? s.candles[0] : s.candles.at(-1);
			const allowed = dir === "older" ? s.hasOlder : s.hasNewer;
			if (!ctrl || !edge || !allowed || s.status !== "ready" || inflight.current[dir]) return;

			inflight.current[dir] = true;
			dispatch({ type: dir === "older" ? "olderStart" : "newerStart" });
			try {
				// after is exclusive; step back one ms so the (possibly open) last candle is refreshed.
				const cursor = dir === "older" ? { before: edge.time } : { after: edge.time - 1 };
				const page = await fetchPage(token, intervalSec, ctrl.signal, cursor);
				if (ctrl.signal.aborted) return;
				if (dir === "older") dispatch({ type: "olderDone", page });
				else dispatch({ type: "newerDone", page, ticks: ticksRef.current, intervalSec });
			} catch {
				// Keep the window; the next approach to this edge retries.
				if (!ctrl.signal.aborted) dispatch({ type: dir === "older" ? "olderFail" : "newerFail" });
			} finally {
				if (ctrlRef.current === ctrl) inflight.current[dir] = false;
			}
		},
		[token, intervalSec],
	);

	const loadOlder = useCallback(() => void load("older"), [load]);
	const loadNewer = useCallback(() => void load("newer"), [load]);
	const setFollowing = useCallback((value: boolean) => dispatch({ type: "follow", value }), []);
	const retry = useCallback(() => {
		dispatch({ type: "reset" });
		setAttempt((n) => n + 1);
	}, []);

	return { state, loadOlder, loadNewer, setFollowing, retry };
}
