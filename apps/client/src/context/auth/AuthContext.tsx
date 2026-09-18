import { createContext, useContext } from "react";
import { useAuthQuery } from "../../hooks/authQueries";
import type { AuthState } from "../../types/auth";

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const {data: user, isLoading, isError} = useAuthQuery();

    const state: AuthState = isLoading ?
        {status: "loading"}
        : isError || !user ?
        { status: "unauthenticated" }
        : { status: "authenticated", user };

    return (
        <AuthContext.Provider value={state}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used inside AuthProvider"
    );
  }

  return context;
}