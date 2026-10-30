import { useState } from "react";
import type { RoomName } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { Pagination } from "./Pagination";
import { clampPage, pageCount, pageSlice } from "../utils/pagination";

interface TradeHistoryPanelProps {
	token: RoomName;
}

type Tab = "trades" | "closed";

interface Pages {
	token: RoomName;
	trades: number;
	closed: number;
}

const TAB_BASE =
	"-mb-px cursor-pointer border-b-2 px-1 pb-3 text-sm font-medium transition-colors whitespace-nowrap";

function tabClass(active: boolean): string {
	return `${TAB_BASE} ${
		active ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"
	}`;
}

export function TradeHistoryPanel({ token }: TradeHistoryPanelProps) {
	const { state } = useSocketContext();
	const [tab, setTab] = useState<Tab>("trades");

	const [pages, setPages] = useState<Pages>({ token, trades: 1, closed: 1 });
	const current: Pages = pages.token === token ? pages : { token, trades: 1, closed: 1 };

	const trades = state.trades[token] ?? [];
	const closedPositions = state.closedPositions[token] ?? [];

	const tradesPage = clampPage(current.trades, trades.length);
	const closedPage = clampPage(current.closed, closedPositions.length);

	const goToTradesPage = (page: number) => setPages({ ...current, trades: page });
	const goToClosedPage = (page: number) => setPages({ ...current, closed: page });

	return (
		<div className="flex flex-col gap-5">
			<div role="tablist" className="flex gap-6 border-b border-line">
				<button
					type="button"
					role="tab"
					aria-selected={tab === "trades"}
					className={tabClass(tab === "trades")}
					onClick={() => setTab("trades")}
				>
					Trade history ({trades.length})
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "closed"}
					className={tabClass(tab === "closed")}
					onClick={() => setTab("closed")}
				>
					Closed positions ({closedPositions.length})
				</button>
			</div>

			{tab === "trades" &&
				(trades.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted">
						No trades yet for {token.toUpperCase()}.
					</p>
				) : (
					<>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[480px] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-xs text-muted">
										<th scope="col" className="py-3 text-left font-medium">
											Side
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Price
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Quantity
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Time
										</th>
									</tr>
								</thead>
								<tbody>
									{pageSlice(trades, tradesPage).map((t) => (
										<tr key={t.id} className="border-b border-line last:border-b-0">
											<td
												className={`py-3 font-semibold ${t.side === "buy" ? "text-up" : "text-down"}`}
											>
												{t.side === "buy" ? "Buy" : "Sell"}
											</td>
											<td className="py-3 text-right tabular-nums">
												${Number(t.price).toFixed(2)}
											</td>
											<td className="py-3 text-right tabular-nums">
												{Number(t.quantity).toFixed(8)}
											</td>
											<td className="py-3 text-right whitespace-nowrap text-muted">
												{new Date(t.createdAt).toLocaleString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<Pagination
							page={tradesPage}
							totalPages={pageCount(trades.length)}
							onChange={goToTradesPage}
						/>
					</>
				))}

			{tab === "closed" &&
				(closedPositions.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted">
						No closed positions yet for {token.toUpperCase()}.
					</p>
				) : (
					<>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[560px] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-xs text-muted">
										<th scope="col" className="py-3 text-right font-medium">
											Qty
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Avg cost
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Avg sell
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Realized P&amp;L
										</th>
										<th scope="col" className="py-3 text-right font-medium">
											Closed
										</th>
									</tr>
								</thead>
								<tbody>
									{pageSlice(closedPositions, closedPage).map((p) => {
										const pnl = Number(p.realizedPnl ?? 0);
										return (
											<tr key={p.id} className="border-b border-line last:border-b-0">
												<td className="py-3 text-right tabular-nums">
													{Number(p.totalBought).toFixed(8)}
												</td>
												<td className="py-3 text-right tabular-nums">
													${Number(p.avgCostBasis).toFixed(2)}
												</td>
												<td className="py-3 text-right tabular-nums">
													${Number(p.avgSellPrice ?? 0).toFixed(2)}
												</td>
												<td
													className={`py-3 text-right font-medium tabular-nums ${pnl >= 0 ? "text-up" : "text-down"}`}
												>
													{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
												</td>
												<td className="py-3 text-right whitespace-nowrap text-muted">
													{p.closedAt ? new Date(p.closedAt).toLocaleString() : "-"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<Pagination
							page={closedPage}
							totalPages={pageCount(closedPositions.length)}
							onChange={goToClosedPage}
						/>
					</>
				))}
		</div>
	);
}
