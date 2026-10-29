export interface ChartPoint {
	price: number;
	timestamp: number;
}

export interface PriceRange {
	min: number;
	max: number;
}

/**
 * Y range for the series, padded so the line never touches the top or bottom edge.
 * A flat series gets a small symmetric band instead of a zero-height range.
 */
export function priceRange(points: ChartPoint[], paddingRatio = 0.05): PriceRange {
	if (points.length === 0) return { min: 0, max: 1 };

	let min = Infinity;
	let max = -Infinity;
	for (const p of points) {
		if (p.price < min) min = p.price;
		if (p.price > max) max = p.price;
	}

	if (min === max) {
		const pad = min === 0 ? 1 : Math.abs(min) * paddingRatio;
		return { min: min - pad, max: max + pad };
	}

	const pad = (max - min) * paddingRatio;
	return { min: min - pad, max: max + pad };
}

/** X position of the point at `index`, spreading the points evenly across the width. */
export function xForIndex(index: number, count: number, width: number): number {
	if (count <= 1) return width / 2;
	return (index / (count - 1)) * width;
}

/** Y position of a price inside the range; higher prices sit closer to the top. */
export function yForPrice(price: number, range: PriceRange, height: number): number {
	const span = range.max - range.min || 1;
	return height - ((price - range.min) / span) * height;
}

/** Index of the point nearest to horizontal position `x`, clamped to the series. */
export function nearestIndex(x: number, count: number, width: number): number | null {
	if (count === 0) return null;
	if (count === 1) return 0;
	const raw = (x / width) * (count - 1);
	return Math.min(count - 1, Math.max(0, Math.round(raw)));
}

export function linePath(
	points: ChartPoint[],
	width: number,
	height: number,
	range: PriceRange,
): string {
	return points
		.map((p, i) => {
			const x = xForIndex(i, points.length, width).toFixed(2);
			const y = yForPrice(p.price, range, height).toFixed(2);
			return `${i === 0 ? "M" : "L"}${x} ${y}`;
		})
		.join(" ");
}

/** The line closed down to the baseline, used for the soft fill under the line. */
export function areaPath(
	points: ChartPoint[],
	width: number,
	height: number,
	range: PriceRange,
): string {
	if (points.length === 0) return "";
	const line = linePath(points, width, height, range);
	const endX = xForIndex(points.length - 1, points.length, width).toFixed(2);
	return `${line} L${endX} ${height} L0 ${height} Z`;
}
