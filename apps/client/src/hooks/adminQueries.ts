import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  AdminUserDetail,
  AdminUsersPage,
  RoomName,
  TradeHistoryEntry,
} from "@crypto-price-ws/shared";
import { env } from "../config/env";
import { authFetch } from "../utils/authFetch";

async function getJson<T>(path: string): Promise<T> {
    const res = await authFetch(`${env.VITE_SERVER_URL}${path}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
    }
    return (await res.json()) as T;
}

export interface AdminUsersParams {
    search: string;
    page: number;
    pageSize: number;
}

export function useAdminUsers({ search, page, pageSize }: AdminUsersParams) {
  return useQuery({
    queryKey: ["admin", "users", { search, page, pageSize }],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) qs.set("search", search);
      return getJson<AdminUsersPage>(`/admin/users?${qs.toString()}`);
    },
    // Keep showing the previous page while the next one loads, so the table doesn't flash.
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminUser(userId: number | null) {
    return useQuery({
        queryKey: ["admin", "user", userId],
        queryFn: () => getJson<AdminUserDetail>(`/admin/users/${userId}`),
        enabled: userId !== null,
        retry: false,
    });
}

export function useAdminUserTrades(userId: number | null, token: RoomName | "") {
    return useQuery({
        queryKey: ["admin", "user", userId, "trades", token],
        queryFn: () =>
            getJson<TradeHistoryEntry[]>(
                `/admin/users/${userId}/trades${token ? `?token=${token}` : ""}`,
            ),
        enabled: userId !== null,
        placeholderData: keepPreviousData,
        retry: false,
    });
}