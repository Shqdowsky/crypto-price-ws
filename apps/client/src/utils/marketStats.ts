/** USD price with enough decimals for cheap tokens: $65,000.00, $2.412, $0.120, $0.00001234. */
export function formatPrice(price: number): string {
	// Under $10 a 2-dp price hides real moves (XRP barely changes), so 4 dp is the minimum.
	const minimumFractionDigits = price >= 10 ? 2 : 4;
	const maximumFractionDigits = price >= 10 ? 2 : price >= 1 ? 4 : price >= 0.01 ? 6 : 8;
	return `$${price.toLocaleString("en-US", { minimumFractionDigits, maximumFractionDigits })}`;
}

/** Signed percent: +1.23% / -0.50% / 0.00%. */
export function formatChange(percent: number): string {
	const rounded = Math.abs(percent) < 0.005 ? 0 : percent;
	const sign = rounded > 0 ? "+" : "";
	return `${sign}${rounded.toFixed(2)}%`;
}
