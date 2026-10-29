/** USD price with enough decimals for cheap tokens: $65,000.00, $0.12, $0.00001234. */
export function formatPrice(price: number): string {
	const maximumFractionDigits = price >= 1 ? 2 : price >= 0.01 ? 6 : 8;
	return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits })}`;
}

/** Signed percent: +1.23% / -0.50% / 0.00%. */
export function formatChange(percent: number): string {
	const rounded = Math.abs(percent) < 0.005 ? 0 : percent;
	const sign = rounded > 0 ? "+" : "";
	return `${sign}${rounded.toFixed(2)}%`;
}
