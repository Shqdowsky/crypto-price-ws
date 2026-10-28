import { Link } from "react-router";
import { FundingHistory, FundingRequestForm } from "../components/FundingSection";

export function DepositPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link to="/account" className="text-sm text-muted hover:text-fg">
          ← Back to account
        </Link>
        <h1 className="mt-3 mb-1 text-[1.75rem] leading-tight font-semibold tracking-tight">
          Deposit
        </h1>
        <p className="text-muted">Request funds. An administrator reviews every request.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <section
          aria-labelledby="request-heading"
          className="rounded-2xl border border-line bg-surface p-6"
        >
          <h2 id="request-heading" className="mb-5 text-lg font-semibold">
            Request funds
          </h2>
          <FundingRequestForm />
        </section>

        <section aria-labelledby="history-heading" className="flex min-w-0 flex-col gap-4">
          <h2 id="history-heading" className="text-lg font-semibold">
            Request history
          </h2>
          <FundingHistory />
        </section>
      </div>
    </div>
  );
}
