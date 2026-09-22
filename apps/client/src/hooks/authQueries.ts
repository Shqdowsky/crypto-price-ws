import {
    useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {PublicUser} from "@crypto-price-ws/shared";
import { env } from '../config/env';
import type { LoginCredentials, RegisterCredentials } from '../types/auth';

export function useAuthQuery(){
    return useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch(`${env.VITE_SERVER_URL}/auth/me`, { credentials: "include", });
            if (!res.ok) throw new Error("unauthenticated");
            return res.json() as Promise<PublicUser>;
        },
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
}

export function useLoginMutation(){
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (credentials: LoginCredentials) => {
            const res = await fetch(`${env.VITE_SERVER_URL}/auth/login`, {
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

export function useLogoutMutation(){
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`${env.VITE_SERVER_URL}/auth/logout`, {
                method: "POST",
                credentials: "include"
            });
            if (!res.ok) throw new Error((await res.json()).message);
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    })
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      const res = await fetch(`${env.VITE_SERVER_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message ?? "Registration failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}