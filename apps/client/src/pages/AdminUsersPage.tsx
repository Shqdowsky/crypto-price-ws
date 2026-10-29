import { useState } from "react";
import { Link } from "react-router";
import { useAdminUsers } from "../hooks/adminQueries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatUsd } from "../utils/format";

const PAGE_SIZE = 20;

export function AdminUsersPage() {
	const [searchInput, setSearchInput] = useState("");
	const search = useDebouncedValue(searchInput.trim(), 300);

	// A page number only makes sense for the search it was picked under. We remember which
	// search it belongs to, and when the search changes the stored page no longer matches,
	// so we fall back to page 1. No effect needed, and no wasted request for the old page.
	const [pageState, setPageState] = useState({ search, page: 1 });
	const page = pageState.search === search ? pageState.page : 1;
	const goToPage = (next: number) => setPageState({ search, page: next });

	const { data, error, isPending, isFetching } = useAdminUsers({
		search,
		page,
		pageSize: PAGE_SIZE,
	});

	const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="mb-1 text-[1.75rem] leading-tight font-semibold tracking-tight">Users</h1>
					<p className="text-muted">Search accounts, balances, and open positions.</p>
				</div>
				<div className="w-full sm:w-80">
					<label htmlFor="admin-user-search" className="mb-1.5 block text-sm text-muted">
						Search by username or email
					</label>
					<input
						id="admin-user-search"
						type="search"
						className="input"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
					/>
				</div>
			</header>

			{error && (
				<p role="alert" className="rounded-2xl border border-line bg-surface p-4 text-sm text-down">
					Could not load users: {error.message}
				</p>
			)}
			{isPending && !error && <p className="text-sm text-muted">Loading users...</p>}

			{data && (
				<div aria-busy={isFetching} className="flex flex-col gap-3">
					<p className="text-sm text-muted tabular-nums">
						{data.total} {data.total === 1 ? "user" : "users"}
						{search && ` matching "${search}"`}
					</p>

					{data.users.length === 0 ? (
						<p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
							No users found.
						</p>
					) : (
						<div className="overflow-x-auto rounded-2xl border border-line bg-surface">
							<table className="w-full min-w-[720px] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-xs text-muted">
										<th scope="col" className="px-5 py-3 text-left font-medium">
											Username
										</th>
										<th scope="col" className="px-4 py-3 text-left font-medium">
											Email
										</th>
										<th scope="col" className="px-4 py-3 text-left font-medium">
											Role
										</th>
										<th scope="col" className="px-4 py-3 text-right font-medium">
											Balance
										</th>
										<th scope="col" className="px-4 py-3 text-right font-medium">
											Open positions
										</th>
										<th scope="col" className="px-5 py-3 text-right font-medium">
											Registered
										</th>
									</tr>
								</thead>
								<tbody>
									{data.users.map((u) => (
										<tr
											key={u.id}
											className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2"
										>
											<td className="px-5 py-4">
												<Link
													to={`/admin/users/${u.id}`}
													className="font-semibold text-link hover:underline"
												>
													{u.username}
												</Link>
											</td>
											<td className="px-4 py-4 text-muted">{u.email}</td>
											<td className="px-4 py-4">
												<span className="inline-block rounded-md bg-primary/16 px-2.5 py-1 text-xs font-semibold text-link">
													{u.role}
												</span>
											</td>
											<td className="px-4 py-4 text-right font-medium tabular-nums">
												{formatUsd(u.balance)}
											</td>
											<td className="px-4 py-4 text-right tabular-nums">{u.openPositionsCount}</td>
											<td className="px-5 py-4 text-right text-muted tabular-nums">
												{new Date(u.createdAt).toLocaleDateString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					<nav aria-label="Pagination" className="flex items-center justify-between gap-3">
						<button
							type="button"
							className="btn h-10 px-4 text-sm"
							onClick={() => goToPage(page - 1)}
							disabled={page <= 1}
						>
							Previous
						</button>
						<span className="text-sm text-muted tabular-nums">
							Page {page} of {totalPages}
						</span>
						<button
							type="button"
							className="btn h-10 px-4 text-sm"
							onClick={() => goToPage(page + 1)}
							disabled={page >= totalPages}
						>
							Next
						</button>
					</nav>
				</div>
			)}
		</div>
	);
}
