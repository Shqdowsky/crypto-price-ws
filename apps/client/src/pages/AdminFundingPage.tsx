import { useState } from "react";
import type { AdminFundingRequest, FundingStatus } from "@crypto-price-ws/shared";
import {
  useAdminFundingRequests,
  useApproveFundingRequest,
  useRejectFundingRequest,
  useTreasury,
} from "../hooks/fundingQueries";
import { useAuthContext } from "../context/auth/AuthContext";
import { formatUsd } from "../utils/format";

const STATUSES: FundingStatus[] = ["pending", "approved", "rejected", "cancelled"];

const CARD = "overflow-hidden rounded-2xl border border-line bg-surface";
const TH = "px-4 py-3 text-left text-xs font-medium text-muted whitespace-nowrap";
const TD = "px-4 py-3.5 text-sm align-middle";

const BTN =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-3.5 text-sm font-semibold transition-all duration-150 ease-out enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-95 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-primary text-white enabled:hover:bg-primary-hover`;
const BTN_DANGER = `${BTN} bg-down/16 text-down enabled:hover:bg-down/24`;
const BTN_GHOST = `${BTN} border border-line bg-surface-2 text-fg enabled:hover:border-line-strong`;

const INPUT =
  "h-9 min-w-0 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg transition-colors placeholder:text-muted hover:border-line-strong focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none";

const STATUS_STYLE: Record<FundingStatus, string> = {
  pending: "bg-primary/16 text-link",
  approved: "bg-up/16 text-up",
  rejected: "bg-down/16 text-down",
  cancelled: "bg-surface-2 text-muted",
};

function StatusBadge({ status }: { status: FundingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function FundingRow({ request }: { request: AdminFundingRequest }) {
  const auth = useAuthContext();
  const approve = useApproveFundingRequest();
  const reject = useRejectFundingRequest();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const busy = approve.isPending || reject.isPending;
  const isOwn = auth.status === "authenticated" && auth.user.id === request.userId;
  const error = approve.error ?? reject.error;

  return (
    <tr className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2">
      <td className={`${TD} pl-5 whitespace-nowrap text-muted tabular-nums`}>
        {new Date(request.createdAt).toLocaleString()}
      </td>
      <td className={`${TD} font-semibold`}>{request.username}</td>
      <td className={`${TD} text-muted`}>{request.email}</td>
      <td className={`${TD} text-right font-medium tabular-nums`}>{formatUsd(request.amount)}</td>
      <td className={TD}>
        <StatusBadge status={request.status} />
      </td>
      <td className={`${TD} pr-5`}>
        {request.status !== "pending" ? (
          <span className="text-muted">{request.reason ?? "-"}</span>
        ) : isOwn ? (
          <span className="text-muted">Your own request</span>
        ) : rejecting ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Rejection reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              className={`${INPUT} w-56`}
            />
            <button
              className={BTN_DANGER}
              disabled={busy || reason.trim() === ""}
              onClick={() => reject.mutate({ id: request.id, reason })}
            >
              Confirm reject
            </button>
            <button className={BTN_GHOST} disabled={busy} onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={BTN_PRIMARY}
              disabled={busy}
              onClick={() => approve.mutate(request.id)}
            >
              Approve
            </button>
            <button className={BTN_DANGER} disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-down">
            {error.message}
          </p>
        )}
      </td>
    </tr>
  );
}

export function AdminFundingPage() {
  const [status, setStatus] = useState<FundingStatus>("pending");
  const treasury = useTreasury();
  const requests = useAdminFundingRequests(status);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[1.75rem] leading-tight font-semibold tracking-tight">
            Funding requests
          </h1>
          <p className="text-muted">Review deposit requests and approve or reject them.</p>
        </div>
        <div className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm">
          <span className="text-muted">Treasury balance</span>
          <strong className="font-semibold tabular-nums">
            {treasury.data !== undefined
              ? formatUsd(treasury.data)
              : treasury.error
                ? "error"
                : "..."}
          </strong>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="funding-status" className="text-sm text-muted">
          Show
        </label>
        <select
          id="funding-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as FundingStatus)}
          className="h-10 cursor-pointer rounded-[10px] border border-line bg-surface-2 px-3 text-sm text-fg capitalize transition-colors hover:border-line-strong focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {requests.error && (
        <p
          role="alert"
          className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down"
        >
          Could not load requests: {requests.error.message}
        </p>
      )}
      {requests.isPending && !requests.error && <p className="text-muted">Loading...</p>}
      {requests.data &&
        (requests.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
            No {status} requests.
          </div>
        ) : (
          <div className={`${CARD} overflow-x-auto`}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={`${TH} pl-5`}>
                    Requested
                  </th>
                  <th scope="col" className={TH}>
                    User
                  </th>
                  <th scope="col" className={TH}>
                    Email
                  </th>
                  <th scope="col" className={`${TH} text-right`}>
                    Amount
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                  <th scope="col" className={`${TH} pr-5`}>
                    {status === "pending" ? "Actions" : "Reason"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.data.map((r) => (
                  <FundingRow key={r.id} request={r} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
