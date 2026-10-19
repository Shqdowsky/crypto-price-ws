import { useState } from "react";
import {
  useCancelFundingRequest,
  useCreateFundingRequest,
  useMyFundingRequests,
} from "../hooks/fundingQueries";
import { formatUsd } from "../utils/format";

const MIN = 1000;
const MAX = 5000;
const HISTORY_SHOWN = 5;

export function FundingSection() {
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const requests = useMyFundingRequests();
  const create = useCreateFundingRequest();
  const cancel = useCancelFundingRequest();
  const hasPending = requests.data?.some((r) => r.status === "pending") ?? false;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value < MIN || value > MAX) {
      setLocalError(`Enter a whole amount from ${MIN} to ${MAX}.`);
      return;
    }
    setLocalError(null);
    create.mutate(value, { onSuccess: () => setAmount("") });
  };

  return (
    <section className="funding-section">
      <h2>Request funds</h2>

      <form onSubmit={submit}>
        <label htmlFor="funding-amount">
          Amount (USD, {MIN}-{MAX})
        </label>{" "}
        <input
          id="funding-amount"
          type="number"
          min={MIN}
          max={MAX}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={hasPending || create.isPending}
        />{" "}
        <button type="submit" disabled={hasPending || create.isPending || amount === ""}>
          {create.isPending ? "Sending..." : "Request"}
        </button>
        {hasPending && <p>You have a request waiting for review. {hasPending}</p>}
        {localError && <p role="alert">{localError}</p>}
        {create.error && <p role="alert">{create.error.message}</p>}
      </form>

      {requests.error && <p role="alert">Could not load requests: {requests.error.message}</p>}

      {requests.data && requests.data.length > 0 && (
        <table className="account-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {requests.data.slice(0, HISTORY_SHOWN).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{formatUsd(r.amount)}</td>
                <td>{r.status}</td>
                <td>{r.reason ?? "-"}</td>
                <th scope="col">
                  <td>
                    {r.status === "pending" && (
                      <button disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>
                        Cancel request
                      </button>
                    )}
                  </td>
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
