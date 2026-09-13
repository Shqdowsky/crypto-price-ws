import { useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "../config/env";
import type { LoginCredentials } from "../types/loginCredentials";

export function useLoginMutation(){
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (credentials: LoginCredentials) => {
            const res = await fetch(`${env.API_URL}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(credentials),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    })
}