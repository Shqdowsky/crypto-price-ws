import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	type KeyboardEvent,
	type PointerEvent,
} from "react";
import type { Candle } from "@crypto-price-ws/shared";
import { formatPrice } from "../utils/marketStats";
import {
	areaPath,
	linePath,
	nearestByTime,
	priceRange,
	timeForX,
	visibleSlice,
	xForTime,
	yForPrice,
} from "../utils/chart";

const HEIGHT = 320;
const PAD = { top: 12, right: 88, bottom: 28, left: 8 };
const DEFAULT_WIDTH = 640;
const GRID_LINES = 4;
const VISIBLE_CANDLES = 120;
const LOAD_MARGIN = 40; // candles from an end of the window that trigger a load
const TAP_PX = 4;
const FRICTION = 0.95;
const MIN_VELOCITY = 0.3; // px per frame

function formatTime(timestamp: number, intervalSec: number): string {
	const d = new Date(timestamp);
	if (intervalSec === 1) {
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
	}
	if (intervalSec < 3600) {
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}
	const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
	return `${date} ${String(d.getHours()).padStart(2, "0")}:00`;
}

interface PriceChartProps {
	candles: Candle[];
	intervalSec: number;
	status: "loading" | "ready" | "error";
	following: boolean;
	hasOlder: boolean;
	hasNewer: boolean;
	loadingOlder: boolean;
	loadingNewer: boolean;
	onLoadOlder: () => void;
	onLoadNewer: () => void;
	onFollowingChange: (following: boolean) => void;
	onRetry: () => void;
}

/**
 * Time-based candle chart (close line). Swipe/drag, trackpad scroll, or arrow keys move through
 * history; older/newer candles load as the view nears either end of the in-memory window.
 */
export function PriceChart(props: PriceChartProps) {
	const {
		candles,
		intervalSec,
		status,
		hasOlder,
		hasNewer,
		loadingOlder,
		loadingNewer,
		onLoadOlder,
		onLoadNewer,
	} = props;
	const containerRef = useRef<HTMLDivElement>(null);
	const [measured, setMeasured] = useState(0);
	const [hover, setHover] = useState<number | null>(null); // candle time under the crosshair
	const [view, setView] = useState<number | null>(null); // view end; null = pinned to the newest
	const gradientId = `price-fill-${useId().replace(/:/g, "")}`;
	const clipId = `${gradientId}-clip`;

	const viewRef = useRef<number | null>(null);
	const raf = useRef(0);
	const drag = useRef<{
		id: number;
		startX: number;
		lastX: number;
		moved: boolean;
		samples: { t: number; x: number }[];
	} | null>(null);

	const width = measured > 0 ? measured : DEFAULT_WIDTH;
	const innerW = Math.max(1, width - PAD.left - PAD.right);
	const innerH = HEIGHT - PAD.top - PAD.bottom;
	const intervalMs = intervalSec * 1000;
	const span = VISIBLE_CANDLES * intervalMs;

	const count = candles.length;
	const first = count > 0 ? candles[0].time : 0;
	const last = count > 0 ? candles[count - 1].time : 0;
	const atLive = view !== null && view >= last && !hasNewer;
	if (atLive) setView(null); // reached the live edge: re-pin to the newest candle
	const end = Math.min(last, Math.max(Math.min(first + span, last), view ?? last));
	const start = end - span;

	// Handlers and the rAF loop read the freshest props through this ref.
	const latest = useRef({ ...props, innerW, last, first, span });
	useEffect(() => {
		latest.current = { ...props, innerW, last, first, span };
		if (atLive) viewRef.current = null;
	});

	const panByTime = useCallback((dt: number) => {
		const s = latest.current;
		if (s.candles.length === 0) return;
		const cur = viewRef.current ?? s.last;
		const next = Math.min(s.last, Math.max(Math.min(s.first + s.span, s.last), cur + dt));
		if (next === cur) return;
		if (next >= s.last && !s.hasNewer) {
			viewRef.current = null;
			setView(null);
			if (!s.following) s.onFollowingChange(true);
		} else {
			viewRef.current = next;
			setView(next);
			if (s.following) s.onFollowingChange(false);
		}
	}, []);

	const stopMomentum = () => cancelAnimationFrame(raf.current);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const update = () => setMeasured(el.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Non-passive so we can keep plain vertical wheel scrolling the page.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
			if (d === 0) return;
			e.preventDefault();
			cancelAnimationFrame(raf.current);
			const s = latest.current;
			panByTime((d * s.span) / s.innerW);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [panByTime]);

	useEffect(() => () => cancelAnimationFrame(raf.current), []);

	// Load more when the view nears an end of the window. Callers guard against duplicates.
	useEffect(() => {
		if (count === 0) return;
		if (hasOlder && end - span - first < LOAD_MARGIN * intervalMs) onLoadOlder();
		if (hasNewer && last - end < LOAD_MARGIN * intervalMs) onLoadNewer();
	}, [count, first, last, end, span, intervalMs, hasOlder, hasNewer, onLoadOlder, onLoadNewer]);

	const range = priceRange(visibleSlice(candles, start, end));
	const shown = visibleSlice(candles, start, end);
	const hoverIdx = hover !== null ? nearestByTime(candles, hover) : null;
	const active = hoverIdx !== null ? candles[hoverIdx] : count > 0 ? candles[count - 1] : null;
	const trend = shown.length > 1 ? shown[shown.length - 1].close - shown[0].open : 0;
	const tone = trend > 0 ? "text-up" : trend < 0 ? "text-down" : "text-link";
	const pathArgs = {
		candles: shown,
		start,
		end,
		width: innerW,
		height: innerH,
		range,
		intervalSec,
	};

	const hoverAt = (clientX: number, svg: SVGSVGElement) => {
		const x = Math.min(innerW, Math.max(0, clientX - svg.getBoundingClientRect().left - PAD.left));
		const i = nearestByTime(candles, timeForX(x, start, end, innerW));
		setHover(i === null ? null : candles[i].time);
	};

	const handlePointerDown = (e: PointerEvent<SVGSVGElement>) => {
		stopMomentum();
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = {
			id: e.pointerId,
			startX: e.clientX,
			lastX: e.clientX,
			moved: false,
			samples: [{ t: performance.now(), x: e.clientX }],
		};
	};

	const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
		const d = drag.current;
		if (!d || d.id !== e.pointerId) {
			if (e.pointerType === "mouse") hoverAt(e.clientX, e.currentTarget);
			return;
		}
		if (!d.moved && Math.abs(e.clientX - d.startX) < TAP_PX) return;
		if (!d.moved) {
			d.moved = true;
			setHover(null);
		}
		// Dragging right reveals older data, so the view end moves back in time.
		panByTime((-(e.clientX - d.lastX) * span) / innerW);
		d.lastX = e.clientX;
		const now = performance.now();
		d.samples = [...d.samples.filter((s) => now - s.t < 100), { t: now, x: e.clientX }];
	};

	const handlePointerUp = (e: PointerEvent<SVGSVGElement>) => {
		const d = drag.current;
		drag.current = null;
		if (!d || d.id !== e.pointerId) return;
		if (!d.moved) {
			hoverAt(e.clientX, e.currentTarget);
			return;
		}
		const a = d.samples[0];
		const b = d.samples[d.samples.length - 1];
		if (!a || b.t === a.t || performance.now() - b.t > 100) return;
		let velocity = ((b.x - a.x) / (b.t - a.t)) * 16; // px per frame
		const step = () => {
			panByTime((-velocity * latest.current.span) / latest.current.innerW);
			velocity *= FRICTION;
			// An edge with more data waiting just holds the view while velocity decays.
			if (Math.abs(velocity) > MIN_VELOCITY) raf.current = requestAnimationFrame(step);
		};
		raf.current = requestAnimationFrame(step);
	};

	const handlePointerCancel = () => {
		drag.current = null;
	};

	const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
		if (count === 0) return;
		if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
			e.preventDefault();
			const base = hoverIdx ?? nearestByTime(candles, end) ?? count - 1;
			const idx = Math.min(count - 1, Math.max(0, base + (e.key === "ArrowLeft" ? -1 : 1)));
			const t = candles[idx].time;
			setHover(t);
			// A press past the edge of the view pans by one candle.
			if (t < start) panByTime(t - start);
			else if (t > end) panByTime(t - end);
		} else if (e.key === "Escape") {
			setHover(null);
		}
	};

	const clearHover = () => setHover(null);
	const labelTimes = [start, start + span / 2, end];
	const activeX = active ? xForTime(active.time, start, end, innerW) : 0;
	const activeVisible = activeX >= 0 && activeX <= innerW;

	let body;
	if (status === "loading") {
		body = (
			<div
				style={{ height: HEIGHT }}
				className="grid place-items-center rounded-xl border border-dashed border-line text-sm text-muted"
			>
				Loading history...
			</div>
		);
	} else if (status === "error") {
		body = (
			<div
				style={{ height: HEIGHT }}
				className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line text-sm text-muted"
			>
				<span>Could not load price history.</span>
				<button
					type="button"
					onClick={props.onRetry}
					className="rounded-lg border border-line px-3 py-1.5 text-fg hover:border-line-strong"
				>
					Retry
				</button>
			</div>
		);
	} else if (!active) {
		body = (
			<div
				style={{ height: HEIGHT }}
				className="grid place-items-center rounded-xl border border-dashed border-line text-sm text-muted"
			>
				No history yet, collecting data...
			</div>
		);
	} else {
		body = (
			<svg
				width={width}
				height={HEIGHT}
				role="img"
				tabIndex={0}
				aria-label={`Price chart of ${count} candles. Latest close ${formatPrice(candles[count - 1].close)}. Swipe or drag sideways to move through history, or use the arrow keys to read individual candles.`}
				className={`${tone} touch-pan-y rounded-lg select-none outline-none focus-visible:ring-3 focus-visible:ring-primary/30 cursor-grab active:cursor-grabbing`}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				onPointerLeave={(e) => e.pointerType === "mouse" && !drag.current && clearHover()}
				onKeyDown={handleKeyDown}
				onBlur={clearHover}
			>
				<defs>
					<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
						<stop offset="100%" stopColor="currentColor" stopOpacity="0" />
					</linearGradient>
					<clipPath id={clipId}>
						<rect x={0} y={-PAD.top} width={innerW} height={HEIGHT} />
					</clipPath>
				</defs>

				<g transform={`translate(${PAD.left} ${PAD.top})`}>
					{Array.from({ length: GRID_LINES + 1 }, (_, i) => {
						const ratio = i / GRID_LINES;
						const y = ratio * innerH;
						const price = range.max - ratio * (range.max - range.min);
						return (
							<g key={i}>
								<line
									x1={0}
									x2={innerW}
									y1={y}
									y2={y}
									className="stroke-line"
									strokeDasharray="3 4"
								/>
								<text
									x={innerW + 8}
									y={y}
									dominantBaseline="middle"
									className="fill-muted text-[11px] tabular-nums"
								>
									{formatPrice(price)}
								</text>
							</g>
						);
					})}

					<g clipPath={`url(#${clipId})`}>
						<path d={areaPath(pathArgs)} fill={`url(#${gradientId})`} />
						<path
							d={linePath(pathArgs)}
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinejoin="round"
							strokeLinecap="round"
						/>
						{loadingOlder && (
							<rect
								x={0}
								y={0}
								width={32}
								height={innerH}
								fill="currentColor"
								className="animate-pulse"
								opacity={0.12}
							/>
						)}
						{loadingNewer && (
							<rect
								x={innerW - 32}
								y={0}
								width={32}
								height={innerH}
								fill="currentColor"
								className="animate-pulse"
								opacity={0.12}
							/>
						)}
					</g>

					{activeVisible && (
						<g>
							{hover !== null && (
								<line
									x1={activeX}
									x2={activeX}
									y1={0}
									y2={innerH}
									className="stroke-line-strong"
									strokeDasharray="4 4"
								/>
							)}
							<circle
								cx={activeX}
								cy={yForPrice(active.close, range, innerH)}
								r={4}
								fill="currentColor"
								className="stroke-surface"
								strokeWidth={2}
							/>
						</g>
					)}

					{labelTimes.map((t, i) => (
						<text
							key={i}
							x={xForTime(t, start, end, innerW)}
							y={innerH + 18}
							textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
							className="fill-muted text-[11px] tabular-nums"
						>
							{formatTime(t, intervalSec)}
						</text>
					))}
				</g>
			</svg>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				{active && status === "ready" ? (
					<>
						<span className="text-2xl font-semibold tabular-nums">{formatPrice(active.close)}</span>
						<span className="text-xs text-muted tabular-nums">
							O {formatPrice(active.open)} · H {formatPrice(active.high)} · L{" "}
							{formatPrice(active.low)} · C {formatPrice(active.close)} ·{" "}
							{formatTime(active.time, intervalSec)}
							{hover === null && " · latest"}
						</span>
					</>
				) : (
					<span className="text-sm text-muted">Waiting for price data...</span>
				)}
			</div>
			<div ref={containerRef} className="w-full">
				{body}
			</div>
		</div>
	);
}
