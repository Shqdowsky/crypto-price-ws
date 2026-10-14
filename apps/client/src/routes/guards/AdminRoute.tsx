import { Navigate, Outlet } from "react-router";
import { useAuthContext } from "../../context/auth/AuthContext";

export function AdminRoute() {
    const auth = useAuthContext();

    if (auth.status === "loading") return <div>Loading..</div>;
    if (auth.status !== "authenticated" || auth.user.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}