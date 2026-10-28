import { useState } from "react";
import { Link } from "react-router";
import { ROOMS } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import type { ConnectionStatus } from "../context/socket/socketReducer";
import { ErrorMessage } from "../components/ErrorMessage";
import { Sparkline } from "../components/Sparkline";
import { formatUsd } from "../utils/format";
import { formatChange, formatPrice } from "../utils/marketStats";
import { TOKEN_NAMES } from "../config/tokens";

const ROOM_OPTIONS = Object.values(ROOMS);

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connected: { label: "Live", dot: "bg-up" },
  connecting: { label: "Connecting", dot: "bg-link animate-pulse" },
  reconnecting: { label: "Reconnecting", dot: "bg-link animate-pulse" },
  disconnected: { label: "Disconnected", dot: "bg-down" },
};

function StatusPill({ status }: { status: ConnectionStatus }) {
  const { label, dot } = STATUS[status];
  return (
    <span
      role="status"
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm"
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Price that briefly flashes green/red whenever it ticks up or down. */
function PriceCell({ price }: { price: number }) {
  const [prev, setPrev] = useState(price);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  if (price !== prev) {
    setPrev(price);
    setDirection(price > prev ? "up" : "down");
  }

  const flash =
    direction === "up" ? "animate-flash-up" : direction === "down" ? "animate-flash-down" : "";

  return (
    <span key={price} className={`rounded px-1.5 py-0.5 ${flash}`}>
      {formatPrice(price)}
    </span>
  );
}

function Skeleton({ className }: { className: string }) {
  return <span className={`inline-block animate-pulse rounded bg-surface-2 ${className}`} />;
}

export function Dashboard() {
  const { state } = useSocketContext();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[1.75rem] leading-tight font-semibold tracking-tight">
            Cryptocurrency prices
          </h1>
          <p className="text-muted">Live prices streamed in real time. Select a token to trade.</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={state.connectionStatus} />
          <div className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm">
            <span className="text-muted">Balance</span>
            <span className="font-semibold tabular-nums">{formatUsd(state.balance)}</span>
          </div>
        </div>
      </header>

      {state.lastError && <ErrorMessage error={state.lastError.message} />}

      <section aria-labelledby="markets-heading">
        <h2 id="markets-heading" className="sr-only">
          Markets
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="w-12 py-3 pl-5 text-left font-medium max-sm:hidden">
                  #
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium max-sm:pl-5">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Price
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  24h change
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium max-md:hidden">
                  Last 60 ticks
                </th>
                <th scope="col" className="py-3 pr-5 pl-2 text-right font-medium sm:pl-4">
                  <span className="sr-only">Trade</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROOM_OPTIONS.map((room, index) => {
                const price = state.prices[room];
                const history = state.priceHistory[room];
                const change = price ? price.PDChange : null;
                const changeColor =
                  change === null || Math.abs(change) < 0.005
                    ? "text-muted"
                    : change > 0
                      ? "text-up"
                      : "text-down";

                return (
                  <tr
                    key={room}
                    className="relative border-b border-line transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <td className="py-4 pl-5 text-muted tabular-nums max-sm:hidden">{index + 1}</td>
                    <td className="px-4 py-4 max-sm:pl-5">
                      <Link
                        to={`/token/${room}`}
                        className="flex items-center gap-3 text-fg after:absolute after:inset-0 hover:no-underline"
                      >
                        <span
                          className="grid size-9 flex-none place-items-center rounded-full bg-primary/16 text-xs font-bold text-link"
                          aria-hidden="true"
                        >
                          {room.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">
                            {TOKEN_NAMES[room] ?? room.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted">{room.toUpperCase()}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums">
                      {price ? (
                        <PriceCell price={price.price} />
                      ) : (
                        <Skeleton className="h-5 w-20" />
                      )}
                    </td>
                    <td className={`px-4 py-4 text-right font-medium tabular-nums ${changeColor}`}>
                      {change === null ? "—" : formatChange(change)}
                    </td>
                    <td className="px-4 py-3 max-md:hidden">
                      <div className="flex justify-center">
                        <Sparkline values={(history ?? []).map((p) => p.price)} />
                      </div>
                    </td>
                    <td className="py-4 pr-4 pl-2 text-right sm:pr-5 sm:pl-4">
                      <span className="inline-block rounded-md bg-primary/16 px-2.5 py-1 text-[0.7rem] font-semibold text-link transition-colors sm:px-3 sm:py-1.5 sm:text-xs [tr:hover_&]:bg-primary [tr:hover_&]:text-white">
                        Trade
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
