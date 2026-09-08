import { CLIENT_EVENTS, SERVER_EVENTS, type RoomName } from "../constants.js";
import type { PublicUser } from "./user.type.js";
import type { ErrorResponse } from "./error.js";

export interface TokenPayload {
    token: RoomName;
    price: number;
    timestamp: number;
}

export interface TradeConfirm {
    id: number;
    token: RoomName;
    side: 'buy' | 'sell';
    price: string;
    createdAt: string;
}

export interface TradeRow {
    id: number;
    token: string;
    side: 'buy' | 'sell';
    price: string;
    created_at: string;
}

export interface ServerToClientEvents {
    [SERVER_EVENTS.PRICE_UPDATE]: (payload: TokenPayload) => void;
    [SERVER_EVENTS.RATE_LIMITED]: (payload: { retryAfterMs: number }) => void;
    [SERVER_EVENTS.PRICE_CURRENT]: (payload: TokenPayload) => void;
    [SERVER_EVENTS.TRADE_CONFIRM]: (payload: TradeConfirm) => void;
    [SERVER_EVENTS.HISTORY_RESULT]: (payload: { trades: TradeRow[] }) => void;
    [SERVER_EVENTS.ERROR]: (payload: ErrorResponse) => void;
}

export interface ClientToServerEvents {
    [CLIENT_EVENTS.SUBSCRIBE]: (room: RoomName) => void;
    [CLIENT_EVENTS.UNSUBSCRIBE]: (room: RoomName) => void;
    [CLIENT_EVENTS.GET_PRICE]: (room: RoomName) => void;
    [CLIENT_EVENTS.HISTORY]: () => void;
    [CLIENT_EVENTS.TRADE]: (payload: { token: RoomName; side: 'buy' | 'sell' }) => void;
}

export interface SocketData {
    user: PublicUser;
}