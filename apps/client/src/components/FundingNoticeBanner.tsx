import { useSocketContext } from "../context/socket/SocketProvider";
import { formatUsd } from "../utils/format";

export function FundingNoticeBanner() {
  const { fundingNotice, dismissFundingNotice } = useSocketContext();
  if (!fundingNotice) return null;

  const amount = formatUsd(fundingNotice.amount);
  const approved = fundingNotice.status === "approved";

  return (
    <div role="status" className={`funding-banner ${approved ? "approved" : "rejected"}`}>
      {approved
        ? `Your funding request for ${amount} was approved.`
        : `Your funding request for ${amount} was rejected: ${fundingNotice.reason ?? "no reason given"}`}{" "}
      <button onClick={dismissFundingNotice}>Dismiss</button>
    </div>
  );
}
