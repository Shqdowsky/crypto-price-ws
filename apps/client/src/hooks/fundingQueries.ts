import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminFundingRequest, FundingRequest, FundingStatus } from "@crypto-price-ws/shared";
import { env } from "../config/env";
import { authFetch } from "../utils/authFetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${env.VITE_SERVER_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

export const MY_FUNDING_KEY = ["funding", "mine"] as const;

export function useMyFundingRequests() {
  return useQuery({
    queryKey: MY_FUNDING_KEY,
    queryFn: () => api<{ requests: FundingRequest[] }>("/funding-requests/mine"),
    select: (data) => data.requests,
    retry: false,
  });
}

export function useCreateFundingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      api<{ request: FundingRequest }>("/funding-requests", post({ amount })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_FUNDING_KEY }),
  });
}

export function useTreasury() {
  return useQuery({
    queryKey: ["admin", "treasury"],
    queryFn: () => api<{ balance: string }>("/admin/treasury"),
    select: (data) => data.balance,
    retry: false,
  });
}

export function useAdminFundingRequests(status: FundingStatus) {
  return useQuery({
    queryKey: ["admin", "funding", status],
    queryFn: () =>
      api<{ requests: AdminFundingRequest[] }>(`/admin/funding-requests?status=${status}`),
    select: (data) => data.requests,
    retry: false,
  });
}

function useReviewInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "funding"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "treasury"] }),
    ]);
}

export function useApproveFundingRequest() {
  const invalidate = useReviewInvalidation();
  return useMutation({
    mutationFn: (id: number) => api(`/admin/funding-requests/${id}/approve`, post()),
    onSuccess: invalidate,
  });
}

export function useRejectFundingRequest() {
  const invalidate = useReviewInvalidation();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api(`/admin/funding-requests/${id}/reject`, post({ reason })),
    onSuccess: invalidate,
  });
}

export function useCancelFundingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ request: FundingRequest }>(`/funding-requests/${id}/cancel`, post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_FUNDING_KEY }),
  });
}
