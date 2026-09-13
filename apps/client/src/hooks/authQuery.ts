import {
  useQuery,
} from '@tanstack/react-query';
import type {PublicUser} from "@crypto-price-ws/shared";
import { env } from '../config/env';

export function useAuthQuery(){
    return useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch(`${env.API_URL}/auth/me`, { credentials: "include", });
            if (!res.ok) throw new Error("unauthenticated");
            return res.json() as Promise<PublicUser>;
        },
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
}