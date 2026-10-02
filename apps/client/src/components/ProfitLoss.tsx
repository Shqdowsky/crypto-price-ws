import type { TradeConfirm } from "@crypto-price-ws/shared";

interface ProfitLossProps {
    trades: TradeConfirm[];
    currentPrice: number | undefined;
}

function calculatePnL(trade: TradeConfirm, currentPrice: number): number {
    const entryPrice = parseFloat(trade.price);
    const diff = currentPrice - entryPrice;
    return trade.side === "buy" ? diff : -diff;
}

export function ProfitLoss({trades,currentPrice}: ProfitLossProps){
    if (trades.length === 0) return null;
    if (currentPrice === undefined) return <p>Waiting for current price...</p>;

    const totalPnL = trades.reduce((sum, t) => sum + calculatePnL(t, currentPrice), 0);
    const isProfit = totalPnL >= 0;

    return (
        <div className="pnl-panel">
            <h3>Position P/L</h3>
            <p style={{ color: isProfit ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                {isProfit ? "+" : ""}
                {totalPnL.toFixed(2)} USD
            </p>

            <details>
                <summary>{trades.length} trade{trades.length !== 1 ? "s" : ""}</summary>
                <ul>
                    {trades.map((t) => (
                        <li key={t.id}>
                            {t.side.toUpperCase()} @ ${parseFloat(t.price).toFixed(2)}
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );

}