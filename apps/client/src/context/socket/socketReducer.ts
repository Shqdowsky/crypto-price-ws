import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
	TokenPayload,
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
	trades: Partial<Record<RoomName, TradeHistoryEntry[]>>;
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
	trades: {},
	balance: "0.00",
	openPositions: {},
	closedPositions: {},
	lastError: null,
	rateLimitedUntil: null,
};

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

function recordPrice(state: SocketState, payload: TokenPayload) {
	const { token, price, timestamp } = payload;
	const history = (state.priceHistory[token] ??= []);

	history.push({ price, timestamp });
	if (history.length > PRICE_HISTORY_LIMIT) history.shift();
	state.prices[token] = payload;
}

// Shared fallback so per-token selectors return a stable reference when nothing is loaded yet.
const EMPTY = Object.freeze([]) as never[];

const socketSlice = createSlice({
	name: "socket",
	initialState: initialSocketState,
	selectors: {
		selectBalance: (state) => state.balance,
		selectLastError: (state) => state.lastError,
		selectPrices: (state) => state.prices,
		selectPriceHistory: (state) => state.priceHistory,
		selectOpenPositions: (state) => state.openPositions,
		selectClosedPositions: (state) => state.closedPositions,
		selectPrice: (state, token: RoomName) => state.prices[token],
		selectTokenPriceHistory: (state, token: RoomName) => state.priceHistory[token],
		selectOpenPosition: (state, token: RoomName) => state.openPositions[token],
		selectTokenClosedPositions: (state, token: RoomName): Position[] =>
			state.closedPositions[token] ?? EMPTY,
		selectTokenTrades: (state, token: RoomName): TradeHistoryEntry[] =>
			state.trades[token] ?? EMPTY,
	},
	reducers: {
		connecting(state) {
			state.connectionStatus = "connecting";
		},
		connected(state) {
			state.connectionStatus = "connected";
		},
		reconnecting(state) {
			state.connectionStatus = "reconnecting";
		},
		disconnected(state) {
			state.connectionStatus = "disconnected";
		},

		priceUpdate(state, action: PayloadAction<TokenPayload>) {
			recordPrice(state, action.payload);
		},
		priceCurrent(state, action: PayloadAction<TokenPayload>) {
			recordPrice(state, action.payload);
		},

		tradeConfirm(state, action: PayloadAction<TradeConfirm>) {
			const { token, position, id, side, price, quantity, createdAt } = action.payload;
			const entry: TradeHistoryEntry = { id, token, side, price, quantity, createdAt };

			state.trades[token] = mergeTradeHistory(state.trades[token] ?? [], [entry]);

			if (position.status === "closed") {
				delete state.openPositions[token];
				state.closedPositions[token] = mergeClosedPositions(state.closedPositions[token] ?? [], [
					position,
				]);
			} else {
				state.openPositions[token] = position;
			}

			state.lastError = null;
		},

		accountState(state, action: PayloadAction<AccountState>) {
			const openPositions: SocketState["openPositions"] = {};
			for (const pos of action.payload.openPositions) {
				openPositions[pos.token] = pos;
			}
			const closedPositions: SocketState["closedPositions"] = {};
			for (const pos of action.payload.closedPositions) {
				(closedPositions[pos.token] ??= []).push(pos);
			}
			state.balance = action.payload.balance;
			state.openPositions = openPositions;
			state.closedPositions = closedPositions;
		},

		balanceUpdated(state, action: PayloadAction<string>) {
			state.balance = action.payload;
		},

		positionHistoryResult(
			state,
			action: PayloadAction<{ token: RoomName; positions: Position[] }>,
		) {
			const { token, positions } = action.payload;
			state.closedPositions[token] = mergeClosedPositions(
				state.closedPositions[token] ?? [],
				positions,
			);
		},

		tradeHistoryResult(
			state,
			action: PayloadAction<{ token: RoomName; trades: TradeHistoryEntry[] }>,
		) {
			const { token, trades } = action.payload;
			state.trades[token] = mergeTradeHistory(state.trades[token] ?? [], trades);
		},

		rateLimited(state, action: PayloadAction<number>) {
			state.rateLimitedUntil = Date.now() + action.payload;
		},

		serverError(state, action: PayloadAction<ErrorResponse>) {
			state.lastError = action.payload;
		},

		clearError(state) {
			state.lastError = null;
		},
	},
});

export const socketActions = socketSlice.actions;
export const socketReducer = socketSlice.reducer;

export const {
	selectBalance,
	selectLastError,
	selectPrices,
	selectPriceHistory,
	selectOpenPositions,
	selectClosedPositions,
	selectPrice,
	selectTokenPriceHistory,
	selectOpenPosition,
	selectTokenClosedPositions,
	selectTokenTrades,
} = socketSlice.getSelectors();
