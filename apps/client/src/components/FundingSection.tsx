import { useState } from "react";
import type { FundingStatus } from "@crypto-price-ws/shared";
import {
  useCancelFundingRequest,
  useCreateFundingRequest,
  useMyFundingRequests,
} from "../hooks/fundingQueries";
import { formatUsd } from "../utils/format";

export const FUNDING_MIN = 1000;
export const FUNDING_MAX = 5000;

const STATUS_STYLES: Record<FundingStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-primary/16 text-link" },
  approved: { label: "Approved", className: "bg-up/10 text-up" },
  rejected: { label: "Rejected", className: "bg-down/10 text-danger" },
  cancelled: { label: "Cancelled", className: "bg-surface-2 text-muted" },
};

/** Amount input and submit button. Disabled while a request is already waiting for review. */
export function FundingRequestForm() {
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const requests = useMyFundingRequests();
  const create = useCreateFundingRequest();
  const hasPending = requests.data?.some((r) => r.status === "pending") ?? false;
  const busy = hasPending || create.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value < FUNDING_MIN || value > FUNDING_MAX) {
      setLocalError(
        `Enter a whole amount from ${formatUsd(FUNDING_MIN)} to ${formatUsd(FUNDING_MAX)}.`,
      );
      return;
    }
    setLocalError(null);
    create.mutate(value, { onSuccess: () => setAmount("") });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="funding-amount" className="mb-2 block text-sm font-medium text-fg">
          Amount (USD)
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted"
            aria-hidden="true"
          >
            $
          </span>
          <input
            id="funding-amount"
            type="number"
            inputMode="numeric"
            min={FUNDING_MIN}
            max={FUNDING_MAX}
            step={1}
            placeholder={String(FUNDING_MIN)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            className="input pl-7 tabular-nums"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Whole amounts from {formatUsd(FUNDING_MIN)} to {formatUsd(FUNDING_MAX)}.
        </p>
      </div>

      {hasPending && (
        <p
          role="status"
          className="rounded-[10px] border border-primary/45 bg-primary/10 px-4 py-3 text-sm text-fg"
        >
          You have a request waiting for review. You can send another once it is approved, rejected,
          or cancelled.
        </p>
      )}
      {localError && (
        <p role="alert" className="text-sm text-danger">
          {localError}
        </p>
      )}
      {create.error && (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      )}

      <button type="submit" disabled={busy || amount === ""} className="btn w-full">
        {create.isPending ? "Sending..." : "Request deposit"}
      </button>
    </form>
  );
}

export function FundingHistory() {
  const requests = useMyFundingRequests();
  const cancel = useCancelFundingRequest();

  if (requests.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        Could not load requests: {requests.error.message}
      </p>
    );
  }
  if (requests.isPending) {
    return <p className="text-sm text-muted">Loading requests...</p>;
  }

  const rows = requests.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-muted">
        No deposit requests yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cancel.error && (
        <p role="alert" className="text-sm text-danger">
          {cancel.error.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="px-5 py-3 text-left font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Amount
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Reason
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = STATUS_STYLES[r.status];
              return (
                <tr key={r.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-4 whitespace-nowrap text-muted tabular-nums">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums">
                    {formatUsd(r.amount)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted">{r.reason ?? "—"}</td>
                  <td className="px-5 py-4 text-right">
                    {r.status === "pending" && (
                      <button
                        type="button"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(r.id)}
                        className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
                      >
                        Cancel request
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
