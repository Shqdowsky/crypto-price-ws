import { Navigate } from "react-router";
import { useAuthContext } from "../../context/AuthContext";

export function ProtectedRoute({children}: {children: React.ReactNode}){
    const auth = useAuthContext();

    if (auth.status === "loading") return <div>Loading..</div>;
    if (auth.status === "unauthenticated") return <Navigate to="/login" replace />;

    return <>{children}</>;
}