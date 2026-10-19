import { useState } from "react";
import { Link, useParams } from "react-router";
import { ROOMS, type RoomName } from "@crypto-price-ws/shared";
import { useAdminUser, useAdminUserTrades } from "../hooks/adminQueries";
import { formatAmount, formatSignedUsd, formatUsd } from "../utils/format";

const TOKEN_OPTIONS = Object.values(ROOMS);
const TRADES_SHOWN_MAX = 500;

export function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const userId = id && /^\d+$/.test(id) ? Number(id) : null;
  const [token, setToken] = useState<RoomName | "">("");

  const detail = useAdminUser(userId);
  const trades = useAdminUserTrades(userId, token);

  if (userId === null) {
    return (
      <div>
        <Link to="/admin">&larr; Back to users</Link>
        <p role="alert">Invalid user id.</p>
      </div>
    );
  }

  const data = detail.data;
  const totalRealizedPnl = data
    ? data.closedPositions.reduce((sum, p) => sum + Number(p.realizedPnl ?? 0), 0)
    : 0;

  return (
    <div className="admin-user">
      <Link to="/admin">&larr; Back to users</Link>

      {detail.error && <p role="alert">Could not load user: {detail.error.message}</p>}
      {detail.isPending && !detail.error && <p>Loading user...</p>}

      {data && (
        <>
          <h1>{data.user.username}</h1>

          <dl className="admin-user-summary">
            <dt>Email</dt>
            <dd>{data.user.email}</dd>
            <dt>Role</dt>
            <dd>{data.user.role}</dd>
            <dt>Balance</dt>
            <dd>{formatUsd(data.user.balance)}</dd>
            <dt>Registered</dt>
            <dd>{new Date(data.user.createdAt).toLocaleString()}</dd>
            <dt>Realized P&amp;L (closed positions)</dt>
            <dd className={totalRealizedPnl >= 0 ? "pnl-positive" : "pnl-negative"}>
              {formatSignedUsd(totalRealizedPnl)}
            </dd>
          </dl>

          <section>
            <h2>Open positions ({data.openPositions.length})</h2>
            {data.openPositions.length === 0 ? (
              <p>No open positions.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Token</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Avg cost</th>
                    <th scope="col">Total bought</th>
                    <th scope="col">Total sold</th>
                    <th scope="col">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openPositions.map((p) => (
                    <tr key={p.id}>
                      <td>{p.token.toUpperCase()}</td>
                      <td>{formatAmount(p.quantity)}</td>
                      <td>{formatUsd(p.avgCostBasis)}</td>
                      <td>{formatAmount(p.totalBought)}</td>
                      <td>{formatAmount(p.totalSold)}</td>
                      <td>{new Date(p.openedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Closed positions ({data.closedPositions.length})</h2>
            {data.closedPositions.length === 0 ? (
              <p>No closed positions.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Token</th>
                    <th scope="col">Bought</th>
                    <th scope="col">Avg cost</th>
                    <th scope="col">Avg sell</th>
                    <th scope="col">Realized P&amp;L</th>
                    <th scope="col">Opened</th>
                    <th scope="col">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.closedPositions.map((p) => {
                    const pnl = Number(p.realizedPnl ?? 0);
                    return (
                      <tr key={p.id}>
                        <td>{p.token.toUpperCase()}</td>
                        <td>{formatAmount(p.totalBought)}</td>
                        <td>{formatUsd(p.avgCostBasis)}</td>
                        <td>{formatUsd(p.avgSellPrice)}</td>
                        <td className={pnl >= 0 ? "pnl-positive" : "pnl-negative"}>
                          {formatSignedUsd(pnl)}
                        </td>
                        <td>{new Date(p.openedAt).toLocaleString()}</td>
                        <td>{p.closedAt ? new Date(p.closedAt).toLocaleString() : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Trades</h2>
            <label htmlFor="admin-trades-token">Token</label>{" "}
            <select
              id="admin-trades-token"
              value={token}
              onChange={(e) => setToken(e.target.value as RoomName | "")}
            >
              <option value="">All tokens</option>
              {TOKEN_OPTIONS.map((room) => (
                <option key={room} value={room}>
                  {room.toUpperCase()}
                </option>
              ))}
            </select>
            {trades.error && <p role="alert">Could not load trades: {trades.error.message}</p>}
            {trades.isPending && !trades.error && <p>Loading trades...</p>}
            {trades.data &&
              (trades.data.length === 0 ? (
                <p>No trades.</p>
              ) : (
                <>
                  <table className="admin-table" aria-busy={trades.isFetching}>
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">Token</th>
                        <th scope="col">Side</th>
                        <th scope="col">Price</th>
                        <th scope="col">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.data.map((t) => (
                        <tr key={t.id} className={`side-${t.side}`}>
                          <td>{new Date(t.createdAt).toLocaleString()}</td>
                          <td>{t.token.toUpperCase()}</td>
                          <td>{t.side === "buy" ? "Buy" : "Sell"}</td>
                          <td>{formatAmount(t.price)}</td>
                          <td>{formatAmount(t.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {trades.data.length >= TRADES_SHOWN_MAX && (
                    <p>Showing the latest {TRADES_SHOWN_MAX} trades.</p>
                  )}
                </>
              ))}
          </section>
        </>
      )}
    </div>
  );
}
