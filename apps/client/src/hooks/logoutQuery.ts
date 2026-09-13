import { useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "../config/env";

export function useLogoutMutation(){
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`${env.API_URL}/logout`, {
                method: "POST",
                credentials: "include"
            });
            if (!res.ok) throw new Error((await res.json()).message);
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    })
}