import { useEffect, useRef } from "react";
import type { RoomName } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { Link } from "react-router";

export function AccountPage() {
    const { state, getPrice } = useSocketContext();
    const pricesFetched = useRef(new Set<RoomName>());

    const openEntries = Object.entries(state.openPositions) as [RoomName, typeof state.openPositions[RoomName]][];

    useEffect(() => {
        for (const [token] of openEntries) {
            if (state.joinedRooms.has(token)) continue;
            if (pricesFetched.current.has(token)) continue;
            pricesFetched.current.add(token);
            getPrice(token);
        }
    }, [openEntries, state.joinedRooms, getPrice]);

    const usdtBalance = Number(state.balance);

    let tokensValue = 0;
    const rows = openEntries.map(([token, position]) => {
        if (!position) return null;
        const price = state.prices[token]?.price ?? null;
        const qty = Number(position.quantity);
        const avgCost = Number(position.avgCostBasis);
        const value = price !== null ? qty * price : null;
        const unrealizedPnl = price !== null ? qty * (price - avgCost) : null;
        if (value !== null) tokensValue += value;

        return { token, qty, avgCost, price, value, unrealizedPnl };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    const netWorth = usdtBalance + tokensValue;

    const allClosedPositions = Object.values(state.closedPositions).flat().filter(
        (p): p is NonNullable<typeof p> => p !== undefined
    );
    const allTimeRealizedPnl = allClosedPositions.reduce(
        (sum, p) => sum + Number(p.realizedPnl ?? 0),
        0
    );

    return (
        <div className="account-page">
            <h1>Account</h1>

            <div className="account-summary">
                <div>
                    <span className="account-summary-label">Net worth</span>
                    <span className="account-summary-value">${netWorth.toFixed(2)}</span>
                </div>
                <div>
                    <span className="account-summary-label">USDT balance</span>
                    <span className="account-summary-value">${usdtBalance.toFixed(2)}</span>
                </div>
                <div>
                    <span className="account-summary-label">All-time realized P&L</span>
                    <span className={`account-summary-value ${allTimeRealizedPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                        {allTimeRealizedPnl >= 0 ? "+" : ""}${allTimeRealizedPnl.toFixed(2)}
                    </span>
                </div>
            </div>

            <h2>Token balances</h2>
            {rows.length === 0 ? (
                <p>No open positions.</p>
            ) : (
                <table className="account-table">
                    <thead>
                        <tr>
                            <th>Token</th><th>Quantity</th><th>Avg cost</th>
                            <th>Price</th><th>Value</th><th>Unrealized P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.token}>
                                <td>{r.token.toUpperCase()}</td>
                                <td>{r.qty.toFixed(8)}</td>
                                <td>${r.avgCost.toFixed(2)}</td>
                                <td>{r.price !== null ? `$${r.price.toFixed(2)}` : "loading..."}</td>
                                <td>{r.value !== null ? `$${r.value.toFixed(2)}` : "—"}</td>
                                <td className={r.unrealizedPnl !== null ? (r.unrealizedPnl >= 0 ? "pnl-positive" : "pnl-negative") : ""}>
                                    {r.unrealizedPnl !== null
                                        ? `${r.unrealizedPnl >= 0 ? "+" : ""}$${r.unrealizedPnl.toFixed(2)}`
                                        : "—"}
                                </td>
                                <td>
                                    <Link to={`/token/${r.token}`} className="account-trade-link">Trade</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}