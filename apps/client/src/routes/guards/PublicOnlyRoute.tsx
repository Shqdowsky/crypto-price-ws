import type React from "react";
import { useAuthContext } from "../../context/auth/AuthContext";
import { Navigate, useLocation } from "react-router";

export function PublicOnlyRoute({children}: {children: React.ReactNode}){
    const auth = useAuthContext();
    const location = useLocation();
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
    console.log(`from pr: ${from}`)
    if (auth.status === "loading") return <div>Loading...</div>;
    if (auth.status === "authenticated") {
        return <Navigate to={from} replace />;
    }

    return <>{children}</>;
}