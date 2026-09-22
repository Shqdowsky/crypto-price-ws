import type { TokenPayload, TradeRow, TradeConfirm, RoomName, ErrorResponse} from "@crypto-price-ws/shared";

export type ConnectionStatus =
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected";

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
    trades: Partial<Record<RoomName, TradeConfirm[]>>;
    tradeHistory: TradeRow[]; 
    lastError: ErrorResponse | null;
    rateLimitedUntil: number | null;
};

export const initialSocketState: SocketState = {
    connectionStatus: "disconnected",
    prices: {},
    priceHistory: {},
    joinedRooms: new Set(),
    trades: {},
    tradeHistory: [],
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
    | { type: "RATE_LIMITED"; retryAfterMs: number }
    | { type: "SERVER_ERROR"; payload: ErrorResponse }
    | { type: "CLEAR_ERROR" }
    | { type: "ROOMS_RESTORED"; rooms: RoomName[] };

export function socketReducer(state: SocketState, action: SocketAction): SocketState {
    switch(action.type){
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
            return { ...state, joinedRooms };
        }

        case "ROOMS_RESTORED": {
            const joinedRooms = new Set(action.rooms);
            return { ...state, joinedRooms };
        }

        case "PRICE_UPDATE":
        case "PRICE_CURRENT": {
            const {token, price, timestamp} = action.payload;

            const existingHistory = state.priceHistory[token] ?? [];
            const updatedHistory = 
                existingHistory.length >= PRICE_HISTORY_LIMIT ? 
                [...existingHistory.slice(1), { price, timestamp }] :
                [...existingHistory, {price, timestamp}]
            return{ 
                ...state,
                prices: { ...state.prices, [token]: action.payload },
                priceHistory: { ...state.priceHistory, [token]: updatedHistory}
            }
        }

        case "TRADE_CONFIRM": {
            const { token } = action.payload;
            const existingTrades = state.trades[token] ?? [];

            return {
                ...state,
                trades: { ...state.trades, [token]: [...existingTrades, action.payload] },
            };
        }

        case "HISTORY_RESULT":
            return { ...state, tradeHistory: action.trades };

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