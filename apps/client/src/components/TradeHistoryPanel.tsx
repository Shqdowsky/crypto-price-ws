import { useState } from "react";
import type { RoomName } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";

interface TradeHistoryPanelProps {
    token: RoomName;
}

type Tab = "trades" | "closed";

export function TradeHistoryPanel({ token }: TradeHistoryPanelProps) {
    const { state } = useSocketContext();
    const [tab, setTab] = useState<Tab>("trades");

    const trades = state.trades[token] ?? [];
    const closedPositions = state.closedPositions[token] ?? [];

    return (
        <div className="trade-history-panel">
            <div className="trade-history-tabs">
                <button className={tab === "trades" ? "active" : ""} onClick={() => setTab("trades")}>
                    Trade History ({trades.length})
                </button>
                <button className={tab === "closed" ? "active" : ""} onClick={() => setTab("closed")}>
                    Closed Positions ({closedPositions.length})
                </button>
            </div>

            {tab === "trades" && (
                trades.length === 0 ? (
                    <p className="trade-history-empty">No trades yet for {token.toUpperCase()}.</p>
                ) : (
                    <table className="trade-history-table">
                        <thead>
                            <tr><th>Side</th><th>Price</th><th>Quantity</th><th>Time</th></tr>
                        </thead>
                        <tbody>
                            {trades.map((t) => (
                                <tr key={t.id} className={`side-${t.side}`}>
                                    <td>{t.side === "buy" ? "Buy" : "Sell"}</td>
                                    <td>${Number(t.price).toFixed(2)}</td>
                                    <td>{Number(t.quantity).toFixed(8)}</td>
                                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
            )}

            {tab === "closed" && (
                closedPositions.length === 0 ? (
                    <p className="trade-history-empty">No closed positions yet for {token.toUpperCase()}.</p>
                ) : (
                    <table className="trade-history-table">
                        <thead>
                            <tr><th>Qty</th><th>Avg Cost</th><th>Avg Sell</th><th>Realized P&L</th><th>Closed</th></tr>
                        </thead>
                        <tbody>
                            {closedPositions.map((p) => {
                                const pnl = Number(p.realizedPnl ?? 0);
                                return (
                                    <tr key={p.id} className={pnl >= 0 ? "pnl-positive" : "pnl-negative"}>
                                        <td>{Number(p.totalBought).toFixed(8)}</td>
                                        <td>${Number(p.avgCostBasis).toFixed(2)}</td>
                                        <td>${Number(p.avgSellPrice ?? 0).toFixed(2)}</td>
                                        <td>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</td>
                                        <td>{p.closedAt ? new Date(p.closedAt).toLocaleString() : "-"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )
            )}
        </div>
    );
}