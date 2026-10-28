import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoomName, TradeConfirm } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { ErrorMessage } from "./ErrorMessage";
import { formatAmount, formatUsd } from "../utils/format";
import { formatPrice } from "../utils/marketStats";

interface TradePanelProps {
  token: RoomName;
}

const QTY_DISPLAY_DP = 8;
const SLIDER_STEP = 0.1;
const MAX_TOASTS = 3;
const TOAST_LIFETIME_MS = 5000;
const TOAST_EXIT_MS = 300;

export function TradePanel({ token }: TradePanelProps) {
  const { trade, state } = useSocketContext();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [percent, setPercent] = useState(0);
  const [pending, setPending] = useState(false);
  const [executed, setExecuted] = useState<TradeConfirm[]>([]);
  const [manualAmount, setManualAmount] = useState<string | null>(null);

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

  const sliderQuantity = floorTo8(maxQuantity * (percent / 100));
  const quantity = manualAmount !== null ? floorTo8(Number(manualAmount) || 0) : sliderQuantity;
  const overLimit = quantity > maxQuantity;

  const displayPercent =
    manualAmount !== null
      ? maxQuantity > 0
        ? Math.min(100, (quantity / maxQuantity) * 100)
        : 0
      : percent;

  const quantityToSend: number | "all" =
    manualAmount === null && percent === 100 ? "all" : quantity;

  const handleSideChange = (nextSide: "buy" | "sell") => {
    setSide(nextSide);
    setPercent(0);
    setManualAmount(null);
  };

  const handleAmountChange = (raw: string) => {
    const value = raw.replace(",", ".");
    if (/^\d*\.?\d{0,8}$/.test(value)) setManualAmount(value);
  };

  const handleSubmit = async () => {
    if (quantity <= 0 || pending) return;
    setPending(true);
    try {
      const result = await trade(token, side, quantityToSend);
      if (result) {
        setPercent(0);
        setManualAmount(null);
        setExecuted((prev) => [result, ...prev].slice(0, MAX_TOASTS));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  };

  const removeExecuted = useCallback((id: number) => {
    setExecuted((prev) => prev.filter((order) => order.id !== id));
  }, []);

  const estimatedTotal = price ? quantity * price : 0;
  const disabled = pending || quantity <= 0 || maxQuantity <= 0 || !price || overLimit;
  const symbol = token.toUpperCase();

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-20 z-40 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-80 sm:gap-3"
      >
        {executed.map((order) => (
          <ExecutionToast key={order.id} order={order} onRemove={removeExecuted} />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => handleSideChange("buy")}
            aria-pressed={side === "buy"}
            className={`h-11 cursor-pointer rounded-lg text-sm font-semibold transition-colors sm:h-10 ${
              side === "buy" ? "bg-up text-white" : "text-muted hover:text-fg"
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => handleSideChange("sell")}
            disabled={!position}
            aria-pressed={side === "sell"}
            className={`h-11 cursor-pointer rounded-lg text-sm font-semibold transition-colors sm:h-10 disabled:cursor-not-allowed disabled:opacity-40 ${
              side === "sell" ? "bg-down text-white" : "text-muted hover:text-fg"
            }`}
          >
            Sell
          </button>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Available</span>
            <span className="tabular-nums">${balance.toFixed(2)}</span>
          </div>
          {position && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted">Holding</span>
                <span className="tabular-nums">
                  {heldQty.toFixed(QTY_DISPLAY_DP)} {symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Avg cost</span>
                <span className="tabular-nums">${Number(position.avgCostBasis).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {state.lastError && <ErrorMessage error={state.lastError} />}

        <div className="flex flex-col gap-2">
          <label
            className={`flex h-12 items-center gap-3 rounded-[10px] border bg-surface-2 px-3.5 transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20 ${
              overLimit ? "border-down" : "border-line hover:border-line-strong"
            }`}
          >
            <span className="text-sm text-muted">Amount</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00000000"
              value={manualAmount ?? quantity.toFixed(QTY_DISPLAY_DP)}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={maxQuantity <= 0}
              aria-invalid={overLimit}
              className="min-w-0 flex-1 bg-transparent text-right font-medium tabular-nums outline-none placeholder:text-gray-500 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-muted">{symbol}</span>
          </label>
          {overLimit && (
            <p className="text-xs text-down">
              Exceeds available {maxQuantity.toFixed(QTY_DISPLAY_DP)} {symbol}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="range"
            aria-label="Percentage of available amount"
            min={0}
            max={100}
            step={SLIDER_STEP}
            value={displayPercent}
            onChange={(e) => {
              setPercent(Number(e.target.value));
              setManualAmount(null);
            }}
            disabled={maxQuantity <= 0}
            className="h-6 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
          />

          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setPercent(pct);
                  setManualAmount(null);
                }}
                disabled={maxQuantity <= 0}
                aria-pressed={Math.round(displayPercent) === pct}
                className={`h-10 cursor-pointer rounded-md text-sm font-medium transition-colors sm:h-8 sm:text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                  Math.round(displayPercent) === pct
                    ? "bg-primary/16 text-link"
                    : "bg-surface-2 text-muted hover:text-fg"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-muted">{side === "buy" ? "Cost" : "Proceeds"}</span>
          <span className="font-medium tabular-nums">${estimatedTotal.toFixed(2)}</span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className={`h-12 w-full cursor-pointer rounded-[10px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted ${
            side === "buy" ? "bg-up hover:brightness-110" : "bg-down hover:brightness-110"
          }`}
        >
          {pending
            ? side === "buy"
              ? "Buying..."
              : "Selling..."
            : side === "buy"
              ? "Buy"
              : "Sell"}
        </button>
      </div>
    </>
  );
}

/** One executed-order card. Slides in from the right, auto-dismisses, and can be closed by hand. */
function ExecutionToast({
  order,
  onRemove,
}: {
  order: TradeConfirm;
  onRemove: (id: number) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    const lifetime = setTimeout(() => setLeaving(true), TOAST_LIFETIME_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(lifetime);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const exit = setTimeout(() => onRemove(order.id), TOAST_EXIT_MS);
    return () => clearTimeout(exit);
  }, [leaving, onRemove, order.id]);

  const isBuy = order.side === "buy";
  const total = Number(order.price) * Number(order.quantity);
  const visible = entered && !leaving;

  return (
    <div
      className={`pointer-events-auto rounded-xl border border-line border-l-4 bg-surface p-3 shadow-2xl sm:p-4 transition-all duration-300 ease-out ${
        isBuy ? "border-l-up" : "border-l-down"
      } ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col leading-tight">
          <span className="text-xs text-muted">Order executed</span>
          <span className={`font-semibold ${isBuy ? "text-up" : "text-down"}`}>
            {isBuy ? "Buy" : "Sell"} {order.token.toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label="Dismiss executed order"
          className="-mt-1 -mr-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs [&_dd]:break-words">
        <div className="flex flex-col gap-1">
          <dt className="text-muted">Quantity</dt>
          <dd className="font-medium tabular-nums">
            {formatAmount(order.quantity)} {order.token.toUpperCase()}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted">Price</dt>
          <dd className="font-medium tabular-nums">{formatPrice(Number(order.price))}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted">Total</dt>
          <dd className="font-medium tabular-nums">{formatUsd(total)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] text-muted tabular-nums">
        {new Date(order.createdAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
