import { Link } from "react-router";
import type { Position, RoomName } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { formatAmount, formatSignedUsd, formatUsd } from "../utils/format";

function toneClass(value: number | null): string {
	if (value === null || value === 0) return "text-muted";
	return value > 0 ? "text-up" : "text-down";
}

function StatCard({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
	return (
		<div className="rounded-2xl border border-line bg-surface p-5">
			<p className="text-sm text-muted">{label}</p>
			<p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
		</div>
	);
}

export function AccountPage() {
	const { state } = useSocketContext();

	const usdtBalance = Number(state.balance);

	const holdings = (
		Object.entries(state.openPositions) as [RoomName, Position | undefined][]
	).flatMap(([token, position]) => {
		if (!position) return [];
		const live = state.prices[token];
		const qty = Number(position.quantity);
		const avgCost = Number(position.avgCostBasis);
		const price = live?.price ?? null;
		return [
			{
				token,
				quantity: position.quantity,
				value: price !== null ? qty * price : null,
				unrealizedPnl: price !== null ? qty * (price - avgCost) : null,
			},
		];
	});

	const tokensValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
	const totalValue = usdtBalance + tokensValue;

	const pricedHoldings = holdings.filter((h) => h.unrealizedPnl !== null);
	const unrealizedTotal =
		pricedHoldings.length > 0
			? pricedHoldings.reduce((sum, h) => sum + (h.unrealizedPnl ?? 0), 0)
			: null;

	const allTimeRealizedPnl = Object.values(state.closedPositions)
		.flat()
		.reduce((sum, p) => sum + Number(p?.realizedPnl ?? 0), 0);

	const allocation = (value: number | null) =>
		value !== null && totalValue > 0 ? (value / totalValue) * 100 : 0;

	return (
		<div className="flex flex-col gap-6">
			<header>
				<h1 className="mb-1 text-[1.75rem] leading-tight font-semibold tracking-tight">Account</h1>
				<p className="text-muted">Your balance, holdings, and performance at a glance.</p>
			</header>

			<section
				aria-labelledby="overview-heading"
				className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8"
			>
				<div className="min-w-0">
					<h2 id="overview-heading" className="text-sm text-muted">
						Estimated total value
					</h2>
					<p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
						{formatUsd(totalValue)}
					</p>
					<p className={`mt-3 text-sm font-medium tabular-nums ${toneClass(allTimeRealizedPnl)}`}>
						All-time realized P&amp;L {formatSignedUsd(allTimeRealizedPnl)}
					</p>
				</div>
				<Link to="/account/deposit" className="btn w-full sm:w-auto sm:px-8">
					Deposit
				</Link>
			</section>

			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard label="USDT balance" value={formatUsd(usdtBalance)} />
				<StatCard
					label="Unrealized P&L"
					value={unrealizedTotal === null ? "—" : formatSignedUsd(unrealizedTotal)}
					tone={toneClass(unrealizedTotal)}
				/>
				<StatCard label="Open positions" value={String(holdings.length)} />
			</div>

			<section aria-labelledby="assets-heading" className="flex flex-col gap-3">
				<h2 id="assets-heading" className="text-lg font-semibold">
					Assets
				</h2>
				<div className="overflow-x-auto rounded-2xl border border-line bg-surface">
					<table className="w-full min-w-[560px] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line text-xs text-muted">
								<th scope="col" className="px-5 py-3 text-left font-medium">
									Asset
								</th>
								<th scope="col" className="px-4 py-3 text-right font-medium">
									Value
								</th>
								<th scope="col" className="px-4 py-3 text-right font-medium">
									Allocation
								</th>
								<th scope="col" className="px-4 py-3 text-right font-medium max-md:hidden">
									Unrealized P&amp;L
								</th>
								<th scope="col" className="py-3 pr-5 pl-4 text-right font-medium">
									<span className="sr-only">Trade</span>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr className="border-b border-line">
								<td className="px-5 py-4">
									<span className="flex flex-col leading-tight">
										<span className="font-semibold">USDT</span>
										<span className="text-xs text-muted">Tether</span>
									</span>
								</td>
								<td className="px-4 py-4 text-right font-medium tabular-nums">
									{formatUsd(usdtBalance)}
								</td>
								<td className="px-4 py-4 text-right">
									<AllocationCell percent={allocation(usdtBalance)} />
								</td>
								<td className="px-4 py-4 text-right text-muted">—</td>
								<td className="px-4 py-4 text-right text-muted max-md:hidden">—</td>
								<td className="py-4 pr-5 pl-4" />
							</tr>

							{holdings.map((h) => (
								<tr key={h.token} className="border-b border-line last:border-b-0">
									<td className="px-5 py-4">
										<span className="flex flex-col leading-tight">
											<span className="font-semibold">{h.token.toUpperCase()}</span>
											<span className="text-xs text-muted tabular-nums">
												{formatAmount(h.quantity)}
											</span>
										</span>
									</td>
									<td className="px-4 py-4 text-right font-medium tabular-nums">
										{h.value !== null ? formatUsd(h.value) : "—"}
									</td>
									<td className="px-4 py-4 text-right">
										<AllocationCell percent={allocation(h.value)} />
									</td>
									<td
										className={`px-4 py-4 text-right font-medium tabular-nums max-md:hidden ${toneClass(h.unrealizedPnl)}`}
									>
										{h.unrealizedPnl !== null ? formatSignedUsd(h.unrealizedPnl) : "—"}
									</td>
									<td className="py-4 pr-5 pl-4 text-right">
										<Link
											to={`/token/${h.token}`}
											className="inline-block rounded-md bg-primary/16 px-3 py-1.5 text-xs font-semibold text-link transition-colors hover:bg-primary hover:text-white"
										>
											Trade
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{holdings.length === 0 && (
					<p className="text-sm text-muted">
						No open positions yet.{" "}
						<Link to="/" className="font-medium">
							Browse markets
						</Link>{" "}
						to start trading.
					</p>
				)}
			</section>
		</div>
	);
}

function AllocationCell({ percent }: { percent: number }) {
	const clamped = Math.min(100, Math.max(0, percent));
	return (
		<div className="flex items-center justify-end gap-3">
			<span className="tabular-nums">{clamped.toFixed(1)}%</span>
			<span
				className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 max-sm:hidden"
				aria-hidden="true"
			>
				<span className="block h-full bg-primary" style={{ width: `${clamped}%` }} />
			</span>
		</div>
	);
}
