import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ROOMS, type RoomName } from "@crypto-price-ws/shared";
import { Pagination } from "../components/Pagination";
import { useAdminUser, useAdminUserTrades } from "../hooks/adminQueries";
import { formatAmount, formatSignedUsd, formatUsd } from "../utils/format";

const TOKEN_OPTIONS = Object.values(ROOMS);
const TRADES_SHOWN_MAX = 500;
const PAGE_SIZE = 10;

const CARD = "overflow-hidden rounded-2xl border border-line bg-surface";
const TH = "px-4 py-3 text-left text-xs font-medium text-muted whitespace-nowrap";
const TD = "px-4 py-3.5 text-sm align-middle whitespace-nowrap";

function pnlColor(value: number): string {
	return value >= 0 ? "text-up" : "text-down";
}

function Stat({
	label,
	children,
	className = "",
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-5 py-4">
			<dt className="text-xs font-medium text-muted">{label}</dt>
			<dd className={`text-lg font-semibold tabular-nums ${className}`}>{children}</dd>
		</div>
	);
}

function SectionHeading({ children }: { children: ReactNode }) {
	return <h2 className="mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

function EmptyState({ children }: { children: ReactNode }) {
	return (
		<div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
			{children}
		</div>
	);
}

export function AdminUserPage() {
	const { id } = useParams<{ id: string }>();
	const userId = id && /^\d+$/.test(id) ? Number(id) : null;
	const [token, setToken] = useState<RoomName | "">("");
	const [closedPage, setClosedPage] = useState(1);
	// Same approach as the users list: a page only applies to the token it was picked under,
	// so changing the token falls back to page 1 without an effect.
	const [tradesPageState, setTradesPageState] = useState({ token, page: 1 });

	const detail = useAdminUser(userId);
	const trades = useAdminUserTrades(userId, token);

	if (userId === null) {
		return (
			<div className="flex flex-col gap-4">
				<Link
					to="/admin"
					className="text-sm text-muted transition-colors hover:text-link hover:no-underline"
				>
					&larr; Back to users
				</Link>
				<p
					role="alert"
					className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down"
				>
					Invalid user id.
				</p>
			</div>
		);
	}

	const data = detail.data;
	const totalRealizedPnl = data
		? data.closedPositions.reduce((sum, p) => sum + Number(p.realizedPnl ?? 0), 0)
		: 0;

	// Closed positions are already loaded, so we slice them on the client.
	const closedPages = Math.max(1, Math.ceil((data?.closedPositions.length ?? 0) / PAGE_SIZE));
	const closedCurrent = Math.min(closedPage, closedPages);
	const closedRows = data
		? data.closedPositions.slice((closedCurrent - 1) * PAGE_SIZE, closedCurrent * PAGE_SIZE)
		: [];

	const tradesPage = tradesPageState.token === token ? tradesPageState.page : 1;
	const tradesPages = Math.max(1, Math.ceil((trades.data?.length ?? 0) / PAGE_SIZE));
	const tradesCurrent = Math.min(tradesPage, tradesPages);
	const tradeRows = trades.data
		? trades.data.slice((tradesCurrent - 1) * PAGE_SIZE, tradesCurrent * PAGE_SIZE)
		: [];
	const goToTradesPage = (next: number) => setTradesPageState({ token, page: next });

	return (
		<div className="flex flex-col gap-6">
			<Link
				to="/admin"
				className="w-fit text-sm text-muted transition-colors hover:text-link hover:no-underline"
			>
				&larr; Back to users
			</Link>

			{detail.error && (
				<p
					role="alert"
					className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down"
				>
					Could not load user: {detail.error.message}
				</p>
			)}
			{detail.isPending && !detail.error && <p className="text-muted">Loading user...</p>}

			{data && (
				<>
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<h1 className="mb-1 text-[1.75rem] leading-tight font-semibold tracking-tight">
								{data.user.username}
							</h1>
							<p className="text-muted">{data.user.email}</p>
						</div>
						<span className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-medium capitalize">
							{data.user.role}
						</span>
					</header>

					<dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<Stat label="Balance">{formatUsd(data.user.balance)}</Stat>
						<Stat label="Realized P&L (closed positions)" className={pnlColor(totalRealizedPnl)}>
							{formatSignedUsd(totalRealizedPnl)}
						</Stat>
						<Stat label="Open positions">{data.openPositions.length}</Stat>
						<Stat label="Registered">
							<span className="text-base font-medium">
								{new Date(data.user.createdAt).toLocaleString()}
							</span>
						</Stat>
					</dl>

					<section>
						<SectionHeading>Open positions ({data.openPositions.length})</SectionHeading>
						{data.openPositions.length === 0 ? (
							<EmptyState>No open positions.</EmptyState>
						) : (
							<div className={`${CARD} overflow-x-auto`}>
								<table className="w-full min-w-[640px] border-collapse">
									<thead>
										<tr className="border-b border-line">
											<th scope="col" className={`${TH} pl-5`}>
												Token
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Quantity
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Avg cost
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Total bought
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Total sold
											</th>
											<th scope="col" className={`${TH} pr-5`}>
												Opened
											</th>
										</tr>
									</thead>
									<tbody>
										{data.openPositions.map((p) => (
											<tr
												key={p.id}
												className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2"
											>
												<td className={`${TD} pl-5 font-semibold`}>{p.token.toUpperCase()}</td>
												<td className={`${TD} text-right tabular-nums`}>
													{formatAmount(p.quantity)}
												</td>
												<td className={`${TD} text-right tabular-nums`}>
													{formatUsd(p.avgCostBasis)}
												</td>
												<td className={`${TD} text-right tabular-nums`}>
													{formatAmount(p.totalBought)}
												</td>
												<td className={`${TD} text-right tabular-nums`}>
													{formatAmount(p.totalSold)}
												</td>
												<td className={`${TD} pr-5 text-muted tabular-nums`}>
													{new Date(p.openedAt).toLocaleString()}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

					<section>
						<SectionHeading>Closed positions ({data.closedPositions.length})</SectionHeading>
						{data.closedPositions.length === 0 ? (
							<EmptyState>No closed positions.</EmptyState>
						) : (
							<div className={`${CARD} overflow-x-auto`}>
								<table className="w-full min-w-[820px] border-collapse">
									<thead>
										<tr className="border-b border-line">
											<th scope="col" className={`${TH} pl-5`}>
												Token
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Bought
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Avg cost
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Avg sell
											</th>
											<th scope="col" className={`${TH} text-right`}>
												Realized P&amp;L
											</th>
											<th scope="col" className={TH}>
												Opened
											</th>
											<th scope="col" className={`${TH} pr-5`}>
												Closed
											</th>
										</tr>
									</thead>
									<tbody>
										{closedRows.map((p) => {
											const pnl = Number(p.realizedPnl ?? 0);
											return (
												<tr
													key={p.id}
													className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2"
												>
													<td className={`${TD} pl-5 font-semibold`}>{p.token.toUpperCase()}</td>
													<td className={`${TD} text-right tabular-nums`}>
														{formatAmount(p.totalBought)}
													</td>
													<td className={`${TD} text-right tabular-nums`}>
														{formatUsd(p.avgCostBasis)}
													</td>
													<td className={`${TD} text-right tabular-nums`}>
														{formatUsd(p.avgSellPrice)}
													</td>
													<td
														className={`${TD} text-right font-medium tabular-nums ${pnlColor(pnl)}`}
													>
														{formatSignedUsd(pnl)}
													</td>
													<td className={`${TD} text-muted tabular-nums`}>
														{new Date(p.openedAt).toLocaleString()}
													</td>
													<td className={`${TD} pr-5 text-muted tabular-nums`}>
														{p.closedAt ? new Date(p.closedAt).toLocaleString() : "-"}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
						{data.closedPositions.length > PAGE_SIZE && (
							<Pagination page={closedCurrent} totalPages={closedPages} onChange={setClosedPage} />
						)}
					</section>

					<section>
						<div className="mb-3 flex flex-wrap items-end justify-between gap-3">
							<SectionHeading>Trades</SectionHeading>
							<div className="flex items-center gap-2">
								<label htmlFor="admin-trades-token" className="text-sm text-muted">
									Token
								</label>
								<select
									id="admin-trades-token"
									value={token}
									onChange={(e) => setToken(e.target.value as RoomName | "")}
									className="h-10 cursor-pointer rounded-[10px] border border-line bg-surface-2 px-3 text-sm text-fg transition-colors hover:border-line-strong focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
								>
									<option value="">All tokens</option>
									{TOKEN_OPTIONS.map((room) => (
										<option key={room} value={room}>
											{room.toUpperCase()}
										</option>
									))}
								</select>
							</div>
						</div>

						{trades.error && (
							<p
								role="alert"
								className="mb-3 rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down"
							>
								Could not load trades: {trades.error.message}
							</p>
						)}
						{trades.isPending && !trades.error && <p className="text-muted">Loading trades...</p>}
						{trades.data &&
							(trades.data.length === 0 ? (
								<EmptyState>No trades.</EmptyState>
							) : (
								<>
									<div className={`${CARD} overflow-x-auto`} aria-busy={trades.isFetching}>
										<table className="w-full min-w-[520px] border-collapse">
											<thead>
												<tr className="border-b border-line">
													<th scope="col" className={`${TH} pl-5`}>
														Time
													</th>
													<th scope="col" className={TH}>
														Token
													</th>
													<th scope="col" className={TH}>
														Side
													</th>
													<th scope="col" className={`${TH} text-right`}>
														Price
													</th>
													<th scope="col" className={`${TH} pr-5 text-right`}>
														Quantity
													</th>
												</tr>
											</thead>
											<tbody>
												{tradeRows.map((t) => (
													<tr
														key={t.id}
														className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2"
													>
														<td className={`${TD} pl-5 text-muted tabular-nums`}>
															{new Date(t.createdAt).toLocaleString()}
														</td>
														<td className={`${TD} font-semibold`}>{t.token.toUpperCase()}</td>
														<td
															className={`${TD} font-semibold ${t.side === "buy" ? "text-up" : "text-down"}`}
														>
															{t.side === "buy" ? "Buy" : "Sell"}
														</td>
														<td className={`${TD} text-right tabular-nums`}>
															{formatAmount(t.price)}
														</td>
														<td className={`${TD} pr-5 text-right tabular-nums`}>
															{formatAmount(t.quantity)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									{trades.data.length > PAGE_SIZE && (
										<Pagination
											page={tradesCurrent}
											totalPages={tradesPages}
											onChange={goToTradesPage}
										/>
									)}
									{trades.data.length >= TRADES_SHOWN_MAX && (
										<p className="mt-3 text-sm text-muted">
											Showing the latest {TRADES_SHOWN_MAX} trades.
										</p>
									)}
								</>
							))}
					</section>
				</>
			)}
		</div>
	);
}
