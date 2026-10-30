import type { ReactNode } from "react";

const FEATURES = [
	"Live market prices",
	"Paper trading with no real risk",
	"Instant order execution",
];

const HERO_GLOW =
	"bg-[radial-gradient(60%_50%_at_20%_100%,rgba(37,99,235,0.35),transparent_70%),radial-gradient(50%_40%_at_100%_0%,rgba(37,99,235,0.18),transparent_70%)]";

export function Brand({
	className = "",
	compact = false,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<span
			className={`inline-flex items-center font-bold tracking-tight text-fg ${
				compact ? "gap-2 text-base" : "gap-3 text-lg"
			} ${className}`}
		>
			<span
				className={`grid place-items-center bg-primary text-white ${
					compact ? "size-7 rounded-lg" : "size-9 rounded-[10px]"
				}`}
				aria-hidden="true"
			>
				<svg width={compact ? 14 : 20} height={compact ? 14 : 20} viewBox="0 0 24 24" fill="none">
					<path
						d="M3 17l6-6 4 4 8-9"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
			crypto-price-ws
		</span>
	);
}

function CheckIcon() {
	return (
		<span
			className="grid size-7 flex-none place-items-center rounded-lg bg-primary/16 text-link"
			aria-hidden="true"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
				<path
					d="M5 12.5l4.5 4.5L19 7"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}

/** Split-screen shell for the auth pages: brand hero on the left, the form (children) on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<main className="grid min-h-svh flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
			<section
				className={`relative hidden flex-col justify-between gap-12 overflow-hidden border-r border-line bg-bg px-[clamp(32px,6vw,96px)] py-12 lg:flex ${HERO_GLOW}`}
			>
				<Brand className="relative" />

				<div className="relative max-w-[480px]">
					<p className="mb-4 text-[clamp(2rem,3.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
						Trade crypto <span className="text-link">in real time.</span>
					</p>
					<p className="mb-8 text-[1.0625rem] text-muted">
						Follow live prices and practice trading with a paper balance, on a platform built for
						speed and clarity.
					</p>
					<ul className="grid list-none gap-3.5 p-0">
						{FEATURES.map((feature) => (
							<li key={feature} className="flex items-center gap-3">
								<CheckIcon />
								{feature}
							</li>
						))}
					</ul>
				</div>

				<svg
					className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] w-full opacity-50"
					viewBox="0 0 600 200"
					preserveAspectRatio="none"
					fill="none"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="auth-chart-fill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#2563eb" stopOpacity="0.45" />
							<stop offset="1" stopColor="#2563eb" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path
						d="M0 160 L50 140 L100 150 L150 110 L200 125 L250 85 L300 100 L350 60 L400 80 L450 40 L500 55 L550 20 L600 30 L600 200 L0 200 Z"
						fill="url(#auth-chart-fill)"
					/>
					<path
						d="M0 160 L50 140 L100 150 L150 110 L200 125 L250 85 L300 100 L350 60 L400 80 L450 40 L500 55 L550 20 L600 30"
						stroke="#5b9dff"
						strokeWidth="2"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>

				<p className="relative text-[0.8125rem] text-muted">
					Simulated trading. No real funds are used.
				</p>
			</section>

			<section className="grid place-items-center bg-[radial-gradient(80%_40%_at_50%_0%,rgba(37,99,235,0.22),transparent_70%)] px-6 py-8 max-lg:content-start max-lg:pt-12 lg:bg-none">
				{children}
			</section>
		</main>
	);
}
