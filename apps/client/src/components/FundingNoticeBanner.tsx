import { useSocketContext } from "../context/socket/SocketProvider";
import { formatUsd } from "../utils/format";

export function FundingNoticeBanner() {
  const { fundingNotice, dismissFundingNotice } = useSocketContext();
  if (!fundingNotice) return null;

  const amount = formatUsd(fundingNotice.amount);
  const approved = fundingNotice.status === "approved";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <div
        role="status"
        className={`flex items-center justify-between gap-4 rounded-[10px] border px-4 py-3 text-sm ${
          approved ? "border-up/45 bg-up/10 text-fg" : "border-down/45 bg-down/10 text-danger"
        }`}
      >
        <span>
          {approved
            ? `Your funding request for ${amount} was approved.`
            : `Your funding request for ${amount} was rejected: ${fundingNotice.reason ?? "no reason given"}`}
        </span>
        <button
          type="button"
          onClick={dismissFundingNotice}
          className="flex-none cursor-pointer rounded-md px-2.5 py-1 font-medium text-fg transition-colors hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
