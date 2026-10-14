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
    <div className="admin-users">
      <h1>Users</h1>

      <label htmlFor="admin-user-search">Search by username or email</label>{" "}
      <input
        id="admin-user-search"
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      {error && <p role="alert">Could not load users: {error.message}</p>}
      {isPending && !error && <p>Loading users...</p>}

      {data && (
        <div aria-busy={isFetching}>
          <p>
            {data.total} {data.total === 1 ? "user" : "users"}
            {search && ` matching "${search}"`}
          </p>

          {data.users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Username</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Open positions</th>
                  <th scope="col">Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/admin/users/${u.id}`}>{u.username}</Link>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{formatUsd(u.balance)}</td>
                    <td>{u.openPositionsCount}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <nav aria-label="Pagination">
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1}>
              Previous
            </button>
            <span>
              {" "}
              Page {page} of {totalPages}{" "}
            </span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}