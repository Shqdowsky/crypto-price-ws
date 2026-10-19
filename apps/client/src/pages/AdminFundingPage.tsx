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
    <tr>
      <td>{new Date(request.createdAt).toLocaleString()}</td>
      <td>{request.username}</td>
      <td>{request.email}</td>
      <td>{formatUsd(request.amount)}</td>
      <td>{request.status}</td>
      <td>
        {request.status !== "pending" ? (
          (request.reason ?? "-")
        ) : isOwn ? (
          "Your own request"
        ) : rejecting ? (
          <>
            <input
              aria-label="Rejection reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
            />{" "}
            <button
              disabled={busy || reason.trim() === ""}
              onClick={() => reject.mutate({ id: request.id, reason })}
            >
              Confirm reject
            </button>{" "}
            <button disabled={busy} onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={() => approve.mutate(request.id)}>
              Approve
            </button>{" "}
            <button disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          </>
        )}
        {error && <p role="alert">{error.message}</p>}
      </td>
    </tr>
  );
}

export function AdminFundingPage() {
  const [status, setStatus] = useState<FundingStatus>("pending");
  const treasury = useTreasury();
  const requests = useAdminFundingRequests(status);

  return (
    <div className="admin-funding">
      <h1>Funding requests</h1>
      <p>
        Treasury balance:{" "}
        <strong>
          {treasury.data !== undefined
            ? formatUsd(treasury.data)
            : treasury.error
              ? "error"
              : "..."}
        </strong>
      </p>
      <label htmlFor="funding-status">Show</label>{" "}
      <select
        id="funding-status"
        value={status}
        onChange={(e) => setStatus(e.target.value as FundingStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {requests.error && <p role="alert">Could not load requests: {requests.error.message}</p>}
      {requests.isPending && !requests.error && <p>Loading...</p>}
      {requests.data &&
        (requests.data.length === 0 ? (
          <p>No {status} requests.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Requested</th>
                <th scope="col">User</th>
                <th scope="col">Email</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">{status === "pending" ? "Actions" : "Reason"}</th>
              </tr>
            </thead>
            <tbody>
              {requests.data.map((r) => (
                <FundingRow key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}
