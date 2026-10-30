import { useEffect, useRef } from "react";
import { useParams, useSearchParams, Navigate, Link } from "react-router";
import { useCandleWindow } from "../hooks/useCandleWindow";
import { useSocketContext } from "../context/socket/SocketProvider";
import { VALID_ROOMS, type RoomName } from "@crypto-price-ws/shared";
import { PriceChart } from "../components/PriceChart";
import { TradePanel } from "../components/TradePanel";
import { TradeHistoryPanel } from "../components/TradeHistoryPanel";
import { TOKEN_NAMES } from "../config/tokens";
const INTERVALS = [
	{ label: "1s", sec: 1 },
	{ label: "1m", sec: 60 },
	{ label: "5m", sec: 300 },
	{ label: "15m", sec: 900 },
	{ label: "1h", sec: 3600 },
] as const;

function TokenChart({ token, intervalSec }: { token: RoomName; intervalSec: number }) {
	const { state, loadOlder, loadNewer, setFollowing, retry } = useCandleWindow(token, intervalSec);
	return (
		<PriceChart
			candles={state.candles}
			intervalSec={intervalSec}
			status={state.status}
			following={state.following}
			hasOlder={state.hasOlder}
			hasNewer={state.hasNewer}
			loadingOlder={state.loadingOlder}
			loadingNewer={state.loadingNewer}
			onLoadOlder={loadOlder}
			onLoadNewer={loadNewer}
			onFollowingChange={setFollowing}
			onRetry={retry}
		/>
	);
}

export function TokenPage() {
	const { tokenName } = useParams<{ tokenName: string }>();
	const { getPositionHistory, getTradeHistory } = useSocketContext();
	const [searchParams, setSearchParams] = useSearchParams();
	const intervalSec =
		INTERVALS.find((i) => i.label === searchParams.get("interval"))?.sec ?? INTERVALS[0].sec;
	const historyFetched = useRef<RoomName | null>(null);

	const isValidToken = tokenName && VALID_ROOMS.has(tokenName as RoomName);
	const token = isValidToken ? (tokenName as RoomName) : null;

	useEffect(() => {
		if (!token) return;
		if (historyFetched.current === token) return;

		historyFetched.current = token;
		getPositionHistory(token);
		getTradeHistory(token);
	}, [token, getPositionHistory, getTradeHistory]);

	if (!isValidToken || !token) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="flex flex-col gap-6">
			<nav aria-label="Breadcrumb" className="text-sm text-muted">
				<Link to="/" className="hover:text-fg">
					Dashboard
				</Link>
				<span className="mx-2" aria-hidden="true">
					/
				</span>
				<span className="text-fg">{token.toUpperCase()}</span>
			</nav>

			<header className="flex flex-col gap-5">
				<div className="flex items-center gap-3">
					<span
						className="grid size-10 flex-none place-items-center rounded-full bg-primary/16 text-xs font-bold text-link"
						aria-hidden="true"
					>
						{token.slice(0, 2).toUpperCase()}
					</span>
					<div>
						<h1 className="text-xl leading-tight font-semibold">
							{TOKEN_NAMES[token] ?? token.toUpperCase()}
						</h1>
						<p className="text-xs text-muted">{token.toUpperCase()}/USDT</p>
					</div>
				</div>
			</header>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
				<section
					aria-label="Price chart"
					className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
				>
					<div
						role="group"
						aria-label="Candle interval"
						className="mb-4 inline-flex rounded-lg border border-line p-0.5"
					>
						{INTERVALS.map(({ label, sec }) => (
							<button
								key={label}
								type="button"
								aria-pressed={sec === intervalSec}
								onClick={() => setSearchParams({ interval: label }, { replace: true })}
								className={`rounded-md px-3 py-1 text-xs font-medium ${sec === intervalSec ? "bg-primary/16 text-link" : "text-muted hover:text-fg"}`}
							>
								{label}
							</button>
						))}
					</div>
					<TokenChart key={`${token}-${intervalSec}`} token={token} intervalSec={intervalSec} />
				</section>

				<aside
					aria-label="Place order"
					className="rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-24"
				>
					<h2 className="mb-4 text-base font-semibold">Spot trade</h2>
					<TradePanel token={token} />
				</aside>
			</div>

			<section
				aria-label="Trading history"
				className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
			>
				<TradeHistoryPanel token={token} />
			</section>
		</div>
	);
}
