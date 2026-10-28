import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PricePoint } from "../context/socket/socketReducer";
import { formatPrice } from "../utils/marketStats";
import { areaPath, linePath, nearestIndex, priceRange, xForIndex, yForPrice } from "../utils/chart";

const HEIGHT = 320;
const PAD = { top: 12, right: 88, bottom: 28, left: 8 };
const DEFAULT_WIDTH = 640;
const GRID_LINES = 4;

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface PriceChartProps {
  data: PricePoint[];
}

/**
 * Line chart of the in-memory price window. Hover, touch, or use the arrow keys to read the
 * price and time at any point; the readout falls back to the latest tick when nothing is active.
 */
export function PriceChart({ data }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = `price-fill-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setMeasured(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = data.length;
  const width = measured > 0 ? measured : DEFAULT_WIDTH;
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const range = priceRange(data);

  const activeIndex = hover !== null && hover < count ? hover : count - 1;
  const active = count > 0 ? data[activeIndex] : null;
  const latest = count > 0 ? data[count - 1] : null;
  const trend = count > 1 ? data[count - 1].price - data[0].price : 0;
  const tone = trend > 0 ? "text-up" : trend < 0 ? "text-down" : "text-link";

  const handlePointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(innerW, Math.max(0, e.clientX - rect.left - PAD.left));
    setHover(nearestIndex(x, count, innerW));
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (count === 0) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      setHover(Math.min(count - 1, Math.max(0, activeIndex + step)));
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const clearHover = () => setHover(null);

  const labelIndexes = count === 0 ? [] : [...new Set([0, Math.floor((count - 1) / 2), count - 1])];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {active ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">{formatPrice(active.price)}</span>
            <span className="text-xs text-muted tabular-nums">
              {formatTime(active.timestamp)}
              {hover === null && " · latest"}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">Waiting for price data...</span>
        )}
      </div>

      <div ref={containerRef} className="w-full">
        {count === 0 || !latest ? (
          <div
            style={{ height: HEIGHT }}
            className="grid place-items-center rounded-xl border border-dashed border-line text-sm text-muted"
          >
            Waiting for price data...
          </div>
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            tabIndex={0}
            aria-label={`Price chart of ${count} points. Latest price ${formatPrice(latest.price)}. Use the arrow keys to read earlier points.`}
            className={`${tone} touch-none rounded-lg select-none outline-none focus-visible:ring-3 focus-visible:ring-primary/30`}
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={clearHover}
            onKeyDown={handleKeyDown}
            onBlur={clearHover}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
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

              <path d={areaPath(data, innerW, innerH, range)} fill={`url(#${gradientId})`} />
              <path
                d={linePath(data, innerW, innerH, range)}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {active && (
                <g>
                  {hover !== null && (
                    <line
                      x1={xForIndex(activeIndex, count, innerW)}
                      x2={xForIndex(activeIndex, count, innerW)}
                      y1={0}
                      y2={innerH}
                      className="stroke-line-strong"
                      strokeDasharray="4 4"
                    />
                  )}
                  <circle
                    cx={xForIndex(activeIndex, count, innerW)}
                    cy={yForPrice(active.price, range, innerH)}
                    r={4}
                    fill="currentColor"
                    className="stroke-surface"
                    strokeWidth={2}
                  />
                </g>
              )}

              {labelIndexes.map((i) => (
                <text
                  key={i}
                  x={xForIndex(i, count, innerW)}
                  y={innerH + 18}
                  textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
                  className="fill-muted text-[11px] tabular-nums"
                >
                  {formatTime(data[i].timestamp)}
                </text>
              ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
