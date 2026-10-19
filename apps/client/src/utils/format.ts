/** Money with a fixed 2 decimals, for balances and P&L. */
export function formatUsd(value: string | number | null): string {
  if (value === null) return "-";
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Signed money for P&L: +$10.00 or -$4.50. */
export function formatSignedUsd(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

/** Quantities and unit prices keep up to 8 decimals so small tokens are not rounded away. */
export function formatAmount(value: string | null): string {
  if (value === null) return "-";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });
}
