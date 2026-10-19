import { Routes, Route, Outlet, Link } from "react-router";
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

function AuthenticatedLayout() {
  const logoutMutation = useLogoutMutation();
  const handleLogOut = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      console.log(err);
    }
  };
  const auth = useAuthContext();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  return (
    <ProtectedRoute>
      <SocketProvider>
        <nav className="app-nav">
          <Link to="/">Dashboard</Link>
          <Link to="/account">Account</Link>
          {isAdmin && <Link to="/admin">Admin</Link>}
          {isAdmin && <Link to="/admin/funding">Funding</Link>}
          <button onClick={handleLogOut} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? "Logging out..." : "Log Out"}
          </button>
        </nav>
        <FundingNoticeBanner />
        <Outlet />
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
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserPage />} />
          <Route path="/admin/funding" element={<AdminFundingPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
