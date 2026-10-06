import { refreshAccessToken } from "./refreshAuth";

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" });

  if (res.status !== 401) return res;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return res;

  return fetch(input, { ...init, credentials: "include" });
}
