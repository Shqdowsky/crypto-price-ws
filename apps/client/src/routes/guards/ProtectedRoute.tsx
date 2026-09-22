import { Navigate, useLocation } from "react-router";
import { useAuthContext } from "../../context/auth/AuthContext";

export function ProtectedRoute({children}: {children: React.ReactNode}){
    const auth = useAuthContext();
    const location = useLocation();

    if (auth.status === "loading") return <div>Loading..</div>;
    if (auth.status === "unauthenticated") return <Navigate to="/login" replace state={{ from: location }} />;

    return <>{children}</>;
}