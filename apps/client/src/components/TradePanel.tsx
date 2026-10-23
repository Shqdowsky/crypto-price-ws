import { useMemo, useState } from "react";
import type { RoomName } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { ErrorMessage } from "./ErrorMessage";

interface TradePanelProps {
  token: RoomName;
}

const QTY_DISPLAY_DP = 8;
const SLIDER_STEP = 0.1;

export function TradePanel({ token }: TradePanelProps) {
  const { trade, state } = useSocketContext();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [percent, setPercent] = useState(0);
  const [pending, setPending] = useState(false);

  const price = state.prices[token]?.price ?? null;
  const balance = Number(state.balance);
  const position = state.openPositions[token];
  const heldQty = position ? Number(position.quantity) : 0;

  const maxQuantity = useMemo(() => {
    if (side === "sell") return heldQty;
    if (!price || price <= 0) return 0;
    return balance / price;
  }, [side, price, balance, heldQty]);

  const floorTo8 = (n: number) => Math.floor(n * 1e8) / 1e8;

  const quantity = floorTo8(maxQuantity * (percent / 100));

  // What the server receives. At 100% the server works out the exact amount itself.
  const quantityToSend: number | "all" = percent === 100 ? "all" : quantity;

  const handleSideChange = (nextSide: "buy" | "sell") => {
    setSide(nextSide);
    setPercent(0);
  };

  const handleSubmit = async () => {
    if (quantity <= 0 || pending) return;
    setPending(true);
    try {
      const result = await trade(token, side, quantityToSend);
      if (result) setPercent(0);
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  };

  const estimatedTotal = price ? quantity * price : 0;
  const disabled = pending || quantity <= 0 || maxQuantity <= 0 || !price;

  return (
    <div className="trade-panel">
      <p className="trade-balance">Balance: ${balance.toFixed(2)}</p>

      {position && (
        <div className="trade-position">
          <p>
            Holding: {heldQty.toFixed(QTY_DISPLAY_DP)} {token.toUpperCase()}
          </p>
          <p>Avg cost: ${Number(position.avgCostBasis).toFixed(2)}</p>
        </div>
      )}

      {state.lastError && <ErrorMessage error={state.lastError} />}

      <div className="trade-side-toggle">
        <button className={side === "buy" ? "active" : ""} onClick={() => handleSideChange("buy")}>
          Buy
        </button>
        <button
          className={side === "sell" ? "active" : ""}
          onClick={() => handleSideChange("sell")}
          disabled={!position}
        >
          Sell
        </button>
      </div>

      <div className="trade-quantity">
        <div className="trade-quantity-value">
          {quantity.toFixed(QTY_DISPLAY_DP)} {token.toUpperCase()}
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={SLIDER_STEP}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          disabled={maxQuantity <= 0}
        />

        <div className="trade-quantity-presets">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              className={percent === pct ? "active" : ""}
              onClick={() => setPercent(pct)}
              disabled={maxQuantity <= 0}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <p className="trade-estimate">
        {side === "buy" ? "Cost" : "Proceeds"}: ${estimatedTotal.toFixed(2)}
      </p>

      <button className={`trade-submit trade-${side}`} onClick={handleSubmit} disabled={disabled}>
        {pending ? (side === "buy" ? "Buying..." : "Selling...") : side === "buy" ? "Buy" : "Sell"}
      </button>
    </div>
  );
}
