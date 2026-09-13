import type React from "react";
import { useAuthContext } from "../../context/AuthContext";
import { Navigate } from "react-router";

export function PublicOnlyRoute({children}: {children: React.ReactNode}){
    const auth = useAuthContext();

    if (auth.status === "loading") return <div>Loading...</div>;
    if (auth.status === "authenticated") return <Navigate to="/" replace />;

    return <>{children}</>;
}