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
    quantity: string;
    realizedPnl: string | null;
    position: OpenPosition | null;
    createdAt: string;
}

export interface BalanceUpdate {
    balance: string;
}

export interface OpenPosition {
    id: number;
    token: RoomName;
    quantity: string;
    avgCostBasis: string;
    totalBought: string;
    totalSold: string;
    openedAt: string;
}

export interface AccountState {
    balance: string;
    openPositions: OpenPosition[];
}

export interface TradeRow {
    id: number;
    user_id: number;
    token: string;
    side: 'buy' | 'sell';
    price: string;
    quantity: string;
    position_id: number;
    created_at: string;
}

export interface PositionRow {
    id: number;
    user_id: number;
    token: string;
    status: 'open' | 'closed';
    quantity: string;
    avg_cost_basis: string;
    total_bought: string;
    total_sold: string;
    running_sell_total: string;
    avg_sell_price: string | null;
    realized_pnl: string | null;
    opened_at: string;
    closed_at: string | null;
}

export interface TradeExecutionResult {
    position: PositionRow;
    trade: TradeRow;
    balance: string;
}

export interface AckResponse<T = void> {
    success: boolean;
    data?: T;
    error?: ErrorResponse;
}

export interface ServerToClientEvents {
    [SERVER_EVENTS.PRICE_UPDATE]: (payload: TokenPayload) => void;
    [SERVER_EVENTS.RATE_LIMITED]: (payload: { retryAfterMs: number }) => void;
    [SERVER_EVENTS.PRICE_CURRENT]: (payload: TokenPayload) => void;
    [SERVER_EVENTS.TRADE_CONFIRM]: (payload: TradeConfirm) => void;
    [SERVER_EVENTS.BALANCE_UPDATED]: (payload: BalanceUpdate) => void;
    [SERVER_EVENTS.HISTORY_RESULT]: (payload: { trades: TradeRow[] }) => void;
    [SERVER_EVENTS.ERROR]: (payload: ErrorResponse) => void;
    [SERVER_EVENTS.ROOMS_RESTORED]: (payload: { rooms: RoomName[] }) => void;
    [SERVER_EVENTS.ACCOUNT_STATE]: (payload: AccountState) => void;
}

export interface ClientToServerEvents {
    [CLIENT_EVENTS.SUBSCRIBE]: (room: RoomName, callback: (res: AckResponse) => void) => void;
    [CLIENT_EVENTS.UNSUBSCRIBE]: (room: RoomName, callback: (res: AckResponse) => void) => void;
    [CLIENT_EVENTS.GET_PRICE]: (room: RoomName, callback: (res: AckResponse<TokenPayload>) => void) => void;
    [CLIENT_EVENTS.HISTORY]: (callback: (res: AckResponse<{ trades: TradeRow[] }>) => void) => void;
    [CLIENT_EVENTS.TRADE]: (
        payload: { token: RoomName; side: 'buy' | 'sell'; quantity: number  },
        callback: (res: AckResponse<TradeConfirm>) => void
    ) => void;
    [CLIENT_EVENTS.GET_ACCOUNT_STATE]: (callback: (res: AckResponse<AccountState>) => void) => void;
}


export interface SocketData {
    user: PublicUser;
}