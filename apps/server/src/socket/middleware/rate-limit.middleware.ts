import type { Socket } from "socket.io";
import {
  RATE_LIMIT,
  SERVER_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@crypto-price-ws/shared";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refilRate: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this._refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  private _refill(): void {
    const tokensToAdd = ((Date.now() - this.lastRefill) / 1000) * this.refilRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = Date.now();
  }

  retryAfterMs(): number {
    if (this.tokens >= 1) {
      return 0;
    }
    return Math.ceil((1 - this.tokens) / this.refilRate) * 1000;
  }

  isFull(): boolean {
    this._refill();
    return this.tokens >= this.capacity;
  }
}

const clientBuckets = new Map<number, TokenBucket>();

export function checkRateLimit(userId: number): { allowed: boolean; retryAfterMs: number } {
  let bucket = clientBuckets.get(userId);
  if (!bucket) {
    bucket = new TokenBucket(RATE_LIMIT.MAX_REQUESTS, RATE_LIMIT.REFILL_RATE);
    clientBuckets.set(userId, bucket);
  }

  const allowed = bucket.consume();
  return { allowed, retryAfterMs: allowed ? 0 : bucket.retryAfterMs() };
}

export function pruneRateLimits(): void {
  for (const [userId, bucket] of clientBuckets) {
    if (bucket.isFull()) clientBuckets.delete(userId);
  }
}

export function rateLimitPacketMiddleware(socket: AppSocket) {
  return ([, ...args]: [string, ...unknown[]], next: (err?: Error) => void): void => {
    const { allowed, retryAfterMs } = checkRateLimit(socket.data.user.id);
    if (allowed) return next();

    socket.emit(SERVER_EVENTS.RATE_LIMITED, { retryAfterMs });
    const ack = args[args.length - 1];
    if (typeof ack === "function") {
      ack({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } });
    }
  };
}

// export function clearRateLimit(socketId: string): void {
//   clientBuckets.delete(socketId);
// }
