import type {
  TokenPayload,
  TradeRow,
  TradeConfirm,
  RoomName,
  ErrorResponse,
  Position,
  AccountState,
  TradeHistoryEntry,
} from "@crypto-price-ws/shared";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface PricePoint {
  price: number;
  timestamp: number;
}

const PRICE_HISTORY_LIMIT = 60;

export interface SocketState {
  connectionStatus: ConnectionStatus;
  prices: Partial<Record<RoomName, TokenPayload>>;
  priceHistory: Partial<Record<RoomName, PricePoint[]>>;
  joinedRooms: Set<RoomName>;
  trades: Partial<Record<RoomName, TradeHistoryEntry[]>>;
  tradeHistory: TradeRow[];
  balance: string;
  openPositions: Partial<Record<RoomName, Position>>;
  closedPositions: Partial<Record<RoomName, Position[]>>;
  lastError: ErrorResponse | null;
  rateLimitedUntil: number | null;
}

export const initialSocketState: SocketState = {
  connectionStatus: "disconnected",
  prices: {},
  priceHistory: {},
  joinedRooms: new Set(),
  trades: {},
  tradeHistory: [],
  balance: "0.00",
  openPositions: {},
  closedPositions: {},
  lastError: null,
  rateLimitedUntil: null,
};

export type SocketAction =
  | { type: "CONNECTING" }
  | { type: "CONNECTED" }
  | { type: "RECONNECTING" }
  | { type: "DISCONNECTED" }
  | { type: "ROOM_JOINED"; room: RoomName }
  | { type: "ROOM_LEFT"; room: RoomName }
  | { type: "PRICE_UPDATE"; payload: TokenPayload }
  | { type: "PRICE_CURRENT"; payload: TokenPayload }
  | { type: "TRADE_CONFIRM"; payload: TradeConfirm }
  | { type: "HISTORY_RESULT"; trades: TradeRow[] }
  | { type: "ACCOUNT_STATE"; payload: AccountState }
  | { type: "BALANCE_UPDATED"; balance: string }
  | { type: "POSITION_HISTORY_RESULT"; token: RoomName; positions: Position[] }
  | { type: "TRADE_HISTORY_RESULT"; token: RoomName; trades: TradeHistoryEntry[] }
  | { type: "RATE_LIMITED"; retryAfterMs: number }
  | { type: "SERVER_ERROR"; payload: ErrorResponse }
  | { type: "CLEAR_ERROR" }
  | { type: "ROOMS_RESTORED"; rooms: RoomName[] };

function mergeClosedPositions(existing: Position[], incoming: Position[]): Position[] {
  const byId = new Map<number, Position>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of incoming) byId.set(p.id, p);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime(),
  );
}

function mergeTradeHistory(
  existing: TradeHistoryEntry[],
  incoming: TradeHistoryEntry[],
): TradeHistoryEntry[] {
  const byId = new Map<number, TradeHistoryEntry>();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) byId.set(t.id, t);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function socketReducer(state: SocketState, action: SocketAction): SocketState {
  switch (action.type) {
    case "CONNECTING":
      return { ...state, connectionStatus: "connecting" };

    case "CONNECTED":
      return { ...state, connectionStatus: "connected" };

    case "RECONNECTING":
      return { ...state, connectionStatus: "reconnecting" };

    case "DISCONNECTED":
      return { ...state, connectionStatus: "disconnected" };

    case "ROOM_JOINED": {
      const joinedRooms = new Set(state.joinedRooms);
      joinedRooms.add(action.room);
      return { ...state, joinedRooms };
    }

    case "ROOM_LEFT": {
      const joinedRooms = new Set(state.joinedRooms);
      joinedRooms.delete(action.room);

      const priceHistory = { ...state.priceHistory };
      delete priceHistory[action.room];

      const trades = { ...state.trades };
      delete trades[action.room];

      return { ...state, joinedRooms, trades, priceHistory };
    }

    case "ROOMS_RESTORED": {
      const joinedRooms = new Set(action.rooms);
      return { ...state, joinedRooms };
    }

    case "PRICE_UPDATE":
    case "PRICE_CURRENT": {
      const { token, price, timestamp } = action.payload;

      const existingHistory = state.priceHistory[token] ?? [];
      const updatedHistory =
        existingHistory.length >= PRICE_HISTORY_LIMIT
          ? [...existingHistory.slice(1), { price, timestamp }]
          : [...existingHistory, { price, timestamp }];
      return {
        ...state,
        prices: { ...state.prices, [token]: action.payload },
        priceHistory: { ...state.priceHistory, [token]: updatedHistory },
      };
    }

    case "TRADE_CONFIRM": {
      const { token, position, id, side, price, quantity, createdAt } = action.payload;

      const entry: TradeHistoryEntry = { id, token, side, price, quantity, createdAt };
      const trades = {
        ...state.trades,
        [token]: mergeTradeHistory(state.trades[token] ?? [], [entry]),
      };

      const openPositions = { ...state.openPositions };
      const closedPositions = { ...state.closedPositions };

      if (position.status === "closed") {
        delete openPositions[token];
        closedPositions[token] = mergeClosedPositions(state.closedPositions[token] ?? [], [
          position,
        ]);
      } else {
        openPositions[token] = position;
      }

      return {
        ...state,
        trades,
        openPositions,
        closedPositions,
      };
    }

    case "HISTORY_RESULT":
      return { ...state, tradeHistory: action.trades };

    case "ACCOUNT_STATE": {
      const openPositions: Partial<Record<RoomName, Position>> = {};
      for (const pos of action.payload.openPositions) {
        openPositions[pos.token] = pos;
      }
      const closedPositions: Partial<Record<RoomName, Position[]>> = {};
      for (const pos of action.payload.closedPositions) {
        closedPositions[pos.token] = [...(closedPositions[pos.token] ?? []), pos];
      }
      return { ...state, balance: action.payload.balance, openPositions, closedPositions };
    }

    case "BALANCE_UPDATED":
      return { ...state, balance: action.balance };

    case "POSITION_HISTORY_RESULT": {
      const closedPositions = { ...state.closedPositions };
      closedPositions[action.token] = mergeClosedPositions(
        state.closedPositions[action.token] ?? [],
        action.positions,
      );
      return { ...state, closedPositions };
    }

    case "TRADE_HISTORY_RESULT": {
      const trades = { ...state.trades };
      trades[action.token] = mergeTradeHistory(state.trades[action.token] ?? [], action.trades);
      return { ...state, trades };
    }

    case "RATE_LIMITED":
      return { ...state, rateLimitedUntil: Date.now() + action.retryAfterMs };

    case "SERVER_ERROR":
      return { ...state, lastError: action.payload };

    case "CLEAR_ERROR":
      return { ...state, lastError: null };

    default:
      return state;
  }
}
