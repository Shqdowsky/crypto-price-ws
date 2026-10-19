import { SERVER_EVENTS, type FundingRequest } from "@crypto-price-ws/shared";
import type { AppServer } from "./index.js";

let io: AppServer | null = null;

export function initNotifier(server: AppServer): void {
  io = server;
}

export const userRoom = (userId: number) => `user:${userId}`;

export function notifyFundingReviewed(
  userId: number,
  request: FundingRequest,
  newBalance?: string,
): void {
  if (!io) return;
  try {
    console.log("cought funding check notice");
    const target = io.to(userRoom(userId));
    console.log("target", target);
    target.emit(SERVER_EVENTS.FUNDING_REVIEWED, { request });
    if (newBalance !== undefined) {
      target.emit(SERVER_EVENTS.BALANCE_UPDATED, { balance: newBalance });
    }
  } catch (err) {
    console.error("funding notification failed", err);
  }
}
