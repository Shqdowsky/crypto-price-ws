import jwt from "jsonwebtoken";
import { io as createClient, type Socket } from "socket.io-client";
import {
  SERVER_EVENTS,
  type AccountState,
  type AckResponse,
  type PublicUser,
  type RoomName,
} from "@crypto-price-ws/shared";
import { env } from "../../src/config/env.js";

const DEFAULT_TIMEOUT_MS = 3000;

interface MintOptions {
  secret?: string;
  expiredSecondsAgo?: number;
}

export function mintToken(userId: number, options: MintOptions = {}): string {
  const payload: PublicUser = {
    id: userId,
    username: `user_${userId}`,
    email: `user_${userId}@example.com`,
  };
  const secret = options.secret ?? (env.JWT_SECRET as string);

  if (options.expiredSecondsAgo !== undefined) {
    const exp = Math.floor(Date.now() / 1000) - options.expiredSecondsAgo;
    return jwt.sign({ ...payload, exp }, secret);
  }
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

function createSocket(url: string, token?: string): Socket {
  return createClient(url, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
    ...(token ? { extraHeaders: { Cookie: `token=${token}` } } : {}),
  });
}

export class TestClient {
  private readonly queues = new Map<string, unknown[]>();
  private readonly waiters = new Map<string, Array<(payload: unknown) => void>>();

  constructor(readonly socket: Socket) {
    socket.onAny((event: string, payload: unknown) => {
      const waiter = this.waiters.get(event)?.shift();
      if (waiter) {
        waiter(payload);
        return;
      }
      const queue = this.queues.get(event) ?? [];
      queue.push(payload);
      this.queues.set(event, queue);
    });
  }

  waitFor<T>(event: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const queued = this.queues.get(event);
    if (queued && queued.length > 0) return Promise.resolve(queued.shift() as T);

    return new Promise<T>((resolve, reject) => {
      const waiter = (payload: unknown) => {
        clearTimeout(timer);
        resolve(payload as T);
      };
      const timer = setTimeout(() => {
        const remaining = (this.waiters.get(event) ?? []).filter((w) => w !== waiter);
        this.waiters.set(event, remaining);
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${event}"`));
      }, timeoutMs);

      this.waiters.set(event, [...(this.waiters.get(event) ?? []), waiter]);
    });
  }

  emit<T = unknown>(event: string, payload?: unknown): Promise<AckResponse<T>> {
    const timed = this.socket.timeout(DEFAULT_TIMEOUT_MS);
    return payload === undefined ? timed.emitWithAck(event) : timed.emitWithAck(event, payload);
  }
}

const openClients = new Set<TestClient>();

export function disconnectAll(): void {
  for (const client of openClients) client.socket.disconnect();
  openClients.clear();
}

export interface Session {
  client: TestClient;
  restoredRooms: RoomName[];
  initialState: AccountState;
}

export async function connectClient(url: string, userId: number): Promise<Session> {
  const socket = createSocket(url, mintToken(userId));
  const client = new TestClient(socket);
  openClients.add(client);

  const connected = new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", (err) => reject(err));
  });
  socket.connect();
  await connected;

  const { rooms } = await client.waitFor<{ rooms: RoomName[] }>(SERVER_EVENTS.ROOMS_RESTORED);
  const initialState = await client.waitFor<AccountState>(SERVER_EVENTS.ACCOUNT_STATE);

  return { client, restoredRooms: rooms, initialState };
}

export function attemptConnect(
  url: string,
  token?: string,
): Promise<{ connected: boolean; errorMessage?: string }> {
  const socket = createSocket(url, token);

  return new Promise((resolve) => {
    socket.once("connect", () => {
      socket.disconnect();
      resolve({ connected: true });
    });
    socket.once("connect_error", (err) => {
      socket.disconnect();
      resolve({ connected: false, errorMessage: err.message });
    });
    socket.connect();
  });
}
