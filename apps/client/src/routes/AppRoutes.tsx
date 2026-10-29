import { useEffect, useState } from "react";
import { Routes, Route, Outlet, Link, NavLink, type NavLinkProps } from "react-router";
import { Brand } from "../components/AuthLayout";
import { ProtectedRoute } from "./guards/ProtectedRoute";
import { PublicOnlyRoute } from "./guards/PublicOnlyRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { SocketProvider } from "../context/socket/SocketProvider";
import { Dashboard } from "../pages/Dashboard";
import { TokenPage } from "../pages/TokenPage";
import { useLogoutMutation } from "../hooks/authQueries";
import { AccountPage } from "../pages/AccountPage";
import { AdminRoute } from "./guards/AdminRoute";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { AdminUserPage } from "../pages/AdminUserPage";
import { useAuthContext } from "../context/auth/AuthContext";
import { AdminFundingPage } from "../pages/AdminFundingPage";
import { FundingNoticeBanner } from "../components/FundingNoticeBanner";
import { DepositPage } from "../pages/DepositPage";

function NavItem({ children, ...props }: NavLinkProps) {
	return (
		<NavLink
			{...props}
			className={({ isActive }) =>
				`flex-none rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:no-underline ${
					isActive ? "bg-primary/16 text-link" : "text-muted hover:bg-surface-2 hover:text-fg"
				}`
			}
		>
			{children}
		</NavLink>
	);
}

function MenuIcon({ open }: { open: boolean }) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			aria-hidden="true"
		>
			{open ? (
				<>
					<path d="M6 6l12 12" />
					<path d="M18 6L6 18" />
				</>
			) : (
				<>
					<path d="M4 6h16" />
					<path d="M4 12h16" />
					<path d="M4 18h16" />
				</>
			)}
		</svg>
	);
}

function AuthenticatedLayout() {
	const logoutMutation = useLogoutMutation();
	const [menuOpen, setMenuOpen] = useState(false);
	const closeMenu = () => setMenuOpen(false);

	const handleLogOut = async () => {
		closeMenu();
		try {
			await logoutMutation.mutateAsync();
		} catch (err) {
			console.log(err);
		}
	};
	const auth = useAuthContext();
	const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

	const links: { to: string; label: string; end?: boolean }[] = [
		{ to: "/", label: "Dashboard", end: true },
		{ to: "/account", label: "Account" },
		...(isAdmin
			? [
					{ to: "/admin", label: "Admin", end: true },
					{ to: "/admin/funding", label: "Funding" },
				]
			: []),
	];

	useEffect(() => {
		if (!menuOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [menuOpen]);

	return (
		<ProtectedRoute>
			<SocketProvider>
				<header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
					<div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
						<Link to="/" className="flex-none hover:no-underline" onClick={closeMenu}>
							<Brand compact className="sm:hidden" />
							<Brand className="max-sm:hidden" />
						</Link>
						<nav
							aria-label="Main"
							className="-mx-1 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex"
						>
							{links.map((link) => (
								<NavItem key={link.to} to={link.to} end={link.end}>
									{link.label}
								</NavItem>
							))}
						</nav>
						<button
							type="button"
							onClick={handleLogOut}
							disabled={logoutMutation.isPending}
							className="hidden h-9 flex-none cursor-pointer rounded-lg border border-line px-3.5 text-sm font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted sm:block"
						>
							{logoutMutation.isPending ? "Logging out..." : "Log Out"}
						</button>
						<button
							type="button"
							onClick={() => setMenuOpen((open) => !open)}
							aria-expanded={menuOpen}
							aria-controls="mobile-menu"
							aria-label={menuOpen ? "Close menu" : "Open menu"}
							className="ml-auto grid size-9 flex-none cursor-pointer place-items-center rounded-lg border border-line text-fg transition-colors hover:bg-surface-2 sm:hidden"
						>
							<MenuIcon open={menuOpen} />
						</button>
					</div>

					{menuOpen && (
						<div
							id="mobile-menu"
							className="absolute inset-x-0 top-full border-b border-line bg-bg/95 shadow-lg backdrop-blur sm:hidden"
						>
							<div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
								<nav aria-label="Mobile" className="flex flex-col gap-1">
									{links.map((link) => (
										<NavItem key={link.to} to={link.to} end={link.end} onClick={closeMenu}>
											{link.label}
										</NavItem>
									))}
								</nav>
								<button
									type="button"
									onClick={handleLogOut}
									disabled={logoutMutation.isPending}
									className="mt-2 h-10 cursor-pointer rounded-lg border border-line px-3.5 text-left text-sm font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
								>
									{logoutMutation.isPending ? "Logging out..." : "Log Out"}
								</button>
							</div>
						</div>
					)}
				</header>
				<FundingNoticeBanner />
				<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
					<Outlet />
				</main>
			</SocketProvider>
		</ProtectedRoute>
	);
}

export function AppRoutes() {
	return (
		<Routes>
			<Route
				path="/login"
				element={
					<PublicOnlyRoute>
						<LoginPage />
					</PublicOnlyRoute>
				}
			/>
			<Route
				path="/register"
				element={
					<PublicOnlyRoute>
						<RegisterPage />
					</PublicOnlyRoute>
				}
			/>

			<Route element={<AuthenticatedLayout />}>
				<Route path="/" element={<Dashboard />} />
				<Route path="/token/:tokenName" element={<TokenPage></TokenPage>} />
				<Route path="/account" element={<AccountPage />} />
				<Route path="/account/deposit" element={<DepositPage />} />
				<Route element={<AdminRoute />}>
					<Route path="/admin" element={<AdminUsersPage />} />
					<Route path="/admin/users/:id" element={<AdminUserPage />} />
					<Route path="/admin/funding" element={<AdminFundingPage />} />
				</Route>
			</Route>
		</Routes>
	);
}
