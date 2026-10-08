import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    AccountState,
    Position,
    TokenPayload,
    TradeConfirm,
    TradeHistoryEntry,
    TradeRow,
} from "@crypto-price-ws/shared";
import {
    initialSocketState,
    socketReducer,
    type SocketAction,
    type SocketState,
} from "./socketReducer";

const PRICE_HISTORY_LIMIT = 60;

function stateWith(overrides: Partial<SocketState> = {}): SocketState {
    return { ...initialSocketState, joinedRooms: new Set(), ...overrides };
}

function makePrice(token: "btc" | "eth", price: number, timestamp: number): TokenPayload {
    return { token, price, timestamp } as TokenPayload;
}

function makePosition(overrides: Partial<Position> = {}): Position {
    return {
        id: 1,
        token: "btc",
        status: "open",
        quantity: "1.00000000",
        avgCostBasis: "100.00000000",
        totalBought: "1.00000000",
        totalSold: "0.00000000",
        avgSellPrice: null,
        realizedPnl: null,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: null,
        ...overrides,
    };
}

function makeClosedPosition(overrides: Partial<Position> = {}): Position {
    return makePosition({
        status: "closed",
        quantity: "0.00000000",
        totalSold: "1.00000000",
        avgSellPrice: "110.00000000",
        realizedPnl: "10.00",
        closedAt: "2026-01-02T00:00:00.000Z",
        ...overrides,
    });
}

function makeTradeConfirm(overrides: Partial<TradeConfirm> = {}): TradeConfirm {
    return {
        id: 1,
        token: "btc",
        side: "buy",
        price: "100.00000000",
        quantity: "1.00000000",
        createdAt: "2026-01-01T00:00:00.000Z",
        position: makePosition(),
        ...overrides,
    };
}

function makeTradeEntry(overrides: Partial<TradeHistoryEntry> = {}): TradeHistoryEntry {
    return {
        id: 1,
        token: "btc",
        side: "buy",
        price: "100.00000000",
        quantity: "1.00000000",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("connection status", () => {
    it.each([
        ["CONNECTING", "connecting"],
        ["CONNECTED", "connected"],
        ["RECONNECTING", "reconnecting"],
        ["DISCONNECTED", "disconnected"],
    ] as const)("%s sets status to %s", (type, expected) => {
        const next = socketReducer(stateWith(), { type });
        expect(next.connectionStatus).toBe(expected);
    });
});

describe("rooms", () => {
    it("ROOM_JOINED adds the room without mutating the previous set", () => {
        const before = stateWith();
        const after = socketReducer(before, { type: "ROOM_JOINED", room: "btc" });

        expect(after.joinedRooms.has("btc")).toBe(true);
        expect(before.joinedRooms.has("btc")).toBe(false);
        expect(after.joinedRooms).not.toBe(before.joinedRooms);
    });

    it("ROOMS_RESTORED replaces the joined set wholesale", () => {
        const before = stateWith({ joinedRooms: new Set(["btc"]) });
        const after = socketReducer(before, { type: "ROOMS_RESTORED", rooms: ["eth", "sol"] });

        expect([...after.joinedRooms].sort()).toEqual(["eth", "sol"]);
    });

    it("ROOM_LEFT clears that room's price history and trades but leaves other rooms alone", () => {
        const before = stateWith({
            joinedRooms: new Set(["btc", "eth"]),
            priceHistory: {
                btc: [{ price: 1, timestamp: 1 }],
                eth: [{ price: 2, timestamp: 2 }],
            },
            trades: {
                btc: [makeTradeEntry({ id: 1, token: "btc" })],
                eth: [makeTradeEntry({ id: 2, token: "eth" })],
            },
        });

        const after = socketReducer(before, { type: "ROOM_LEFT", room: "btc" });

        expect(after.joinedRooms.has("btc")).toBe(false);
        expect(after.joinedRooms.has("eth")).toBe(true);
        expect(after.priceHistory.btc).toBeUndefined();
        expect(after.priceHistory.eth).toHaveLength(1);
        expect(after.trades.eth).toHaveLength(1);
    });

    it("ROOM_LEFT does not touch open or closed positions (account data, not room data)", () => {
        const before = stateWith({
            joinedRooms: new Set(["btc"]),
            openPositions: { btc: makePosition() },
            closedPositions: { btc: [makeClosedPosition({ id: 9 })] },
        });

        const after = socketReducer(before, { type: "ROOM_LEFT", room: "btc" });

        expect(after.openPositions.btc).toEqual(before.openPositions.btc);
        expect(after.closedPositions.btc).toHaveLength(1);
    });

    it.todo("ROOM_LEFT: decide whether persisted per-token trade history should survive leaving a room");
});

describe("prices", () => {
    it.each(["PRICE_UPDATE", "PRICE_CURRENT"] as const)(
        "%s stores the latest price and appends to history",
        (type) => {
            const payload = makePrice("btc", 65000, 1000);
            const after = socketReducer(stateWith(), { type, payload });

            expect(after.prices.btc).toEqual(payload);
            expect(after.priceHistory.btc).toEqual([{ price: 65000, timestamp: 1000 }]);
        },
    );

    it("keeps history per token independently", () => {
        let state = stateWith();
        state = socketReducer(state, { type: "PRICE_UPDATE", payload: makePrice("btc", 1, 1) });
        state = socketReducer(state, { type: "PRICE_UPDATE", payload: makePrice("eth", 2, 2) });

        expect(state.priceHistory.btc).toHaveLength(1);
        expect(state.priceHistory.eth).toHaveLength(1);
    });

    it("caps history at the limit, dropping the oldest points first", () => {
        let state = stateWith();
        for (let i = 0; i < PRICE_HISTORY_LIMIT + 5; i++) {
            state = socketReducer(state, {
                type: "PRICE_UPDATE",
                payload: makePrice("btc", i, 1000 + i),
            });
        }

        const history = state.priceHistory.btc!;
        expect(history).toHaveLength(PRICE_HISTORY_LIMIT);
        expect(history[0]).toEqual({ price: 5, timestamp: 1005 });
        expect(history[history.length - 1]).toEqual({
            price: PRICE_HISTORY_LIMIT + 4,
            timestamp: 1000 + PRICE_HISTORY_LIMIT + 4,
        });
    });
});

describe("TRADE_CONFIRM", () => {
    it("a trade that leaves the position open updates openPositions and appends a trade entry", () => {
        const confirm = makeTradeConfirm({
            id: 10,
            position: makePosition({ quantity: "10.00000000" }),
        });

        const after = socketReducer(stateWith(), { type: "TRADE_CONFIRM", payload: confirm });

        expect(after.openPositions.btc?.quantity).toBe("10.00000000");
        expect(after.closedPositions.btc).toBeUndefined();
        expect(after.trades.btc).toHaveLength(1);
    });

    it("stores only the flat trade fields in trades, not the nested position", () => {
        const confirm = makeTradeConfirm({ id: 10 });
        const after = socketReducer(stateWith(), { type: "TRADE_CONFIRM", payload: confirm });

        expect(after.trades.btc![0]).toEqual({
            id: 10,
            token: "btc",
            side: "buy",
            price: "100.00000000",
            quantity: "1.00000000",
            createdAt: "2026-01-01T00:00:00.000Z",
        });
    });

    it("a trade that closes the position moves it from open to closed and still logs the trade", () => {
        const before = stateWith({ openPositions: { btc: makePosition({ id: 7 }) } });
        const confirm = makeTradeConfirm({
            id: 11,
            side: "sell",
            position: makeClosedPosition({ id: 7 }),
        });

        const after = socketReducer(before, { type: "TRADE_CONFIRM", payload: confirm });

        expect(after.openPositions.btc).toBeUndefined();
        expect(after.closedPositions.btc).toHaveLength(1);
        expect(after.closedPositions.btc![0]!.id).toBe(7);
        expect(after.trades.btc).toHaveLength(1);
    });

    it("buy -> partial sell -> closing sell ends with no open position and one closed", () => {
        const actions: TradeConfirm[] = [
            makeTradeConfirm({
                id: 1,
                side: "buy",
                createdAt: "2026-01-01T00:00:01.000Z",
                position: makePosition({ id: 5, quantity: "10.00000000" }),
            }),
            makeTradeConfirm({
                id: 2,
                side: "sell",
                createdAt: "2026-01-01T00:00:02.000Z",
                position: makePosition({ id: 5, quantity: "6.00000000", totalSold: "4.00000000" }),
            }),
            makeTradeConfirm({
                id: 3,
                side: "sell",
                createdAt: "2026-01-01T00:00:03.000Z",
                position: makeClosedPosition({ id: 5 }),
            }),
        ];

        const final = actions.reduce(
            (state, payload) => socketReducer(state, { type: "TRADE_CONFIRM", payload }),
            stateWith(),
        );

        expect(final.openPositions.btc).toBeUndefined();
        expect(final.closedPositions.btc).toHaveLength(1);
        expect(final.trades.btc!.map((t) => t.id)).toEqual([3, 2, 1]); // newest first
    });

    it("is idempotent for the same trade id (duplicate delivery does not double-log)", () => {
        const confirm = makeTradeConfirm({ id: 42 });

        let state = socketReducer(stateWith(), { type: "TRADE_CONFIRM", payload: confirm });
        state = socketReducer(state, { type: "TRADE_CONFIRM", payload: confirm });

        expect(state.trades.btc).toHaveLength(1);
    });

    it("keeps trades sorted newest-first even when an older trade arrives later", () => {
        let state = stateWith();
        state = socketReducer(state, {
            type: "TRADE_CONFIRM",
            payload: makeTradeConfirm({ id: 2, createdAt: "2026-01-01T00:00:10.000Z" }),
        });
        state = socketReducer(state, {
            type: "TRADE_CONFIRM",
            payload: makeTradeConfirm({ id: 1, createdAt: "2026-01-01T00:00:05.000Z" }),
        });

        expect(state.trades.btc!.map((t) => t.id)).toEqual([2, 1]);
    });

    it("does not affect other tokens' state", () => {
        const before = stateWith({
            openPositions: { eth: makePosition({ id: 99, token: "eth" }) },
            trades: { eth: [makeTradeEntry({ id: 99, token: "eth" })] },
        });

        const after = socketReducer(before, {
            type: "TRADE_CONFIRM",
            payload: makeTradeConfirm({ id: 1, token: "btc" }),
        });

        expect(after.openPositions.eth).toEqual(before.openPositions.eth);
        expect(after.trades.eth).toHaveLength(1);
    });

    it("does not mutate the previous state", () => {
        const before = stateWith();
        const openBefore = before.openPositions;

        const after = socketReducer(before, {
            type: "TRADE_CONFIRM",
            payload: makeTradeConfirm(),
        });

        expect(after).not.toBe(before);
        expect(after.openPositions).not.toBe(openBefore);
        expect(before.openPositions.btc).toBeUndefined();
        expect(before.trades.btc).toBeUndefined();
    });
});

describe("ACCOUNT_STATE", () => {
    it("sets balance and groups open/closed positions by token", () => {
        const payload: AccountState = {
            balance: "850.00",
            openPositions: [
                makePosition({ id: 1, token: "btc" }),
                makePosition({ id: 2, token: "eth" }),
            ],
            closedPositions: [
                makeClosedPosition({ id: 3, token: "btc" }),
                makeClosedPosition({ id: 4, token: "eth" }),
                makeClosedPosition({ id: 5, token: "btc" }),
            ],
        };

        const after = socketReducer(stateWith(), { type: "ACCOUNT_STATE", payload });

        expect(after.balance).toBe("850.00");
        expect(after.openPositions.btc!.id).toBe(1);
        expect(after.openPositions.eth!.id).toBe(2);
        // payload order preserved within a token (server sends newest-closed first)
        expect(after.closedPositions.btc!.map((p) => p.id)).toEqual([3, 5]);
        expect(after.closedPositions.eth!.map((p) => p.id)).toEqual([4]);
    });

    it("fully replaces previous positions instead of merging (authoritative snapshot)", () => {
        const before = stateWith({
            openPositions: { eth: makePosition({ id: 99, token: "eth" }) },
            closedPositions: { eth: [makeClosedPosition({ id: 98, token: "eth" })] },
        });

        const after = socketReducer(before, {
            type: "ACCOUNT_STATE",
            payload: {
                balance: "1000.00",
                openPositions: [makePosition({ id: 1, token: "btc" })],
                closedPositions: [],
            },
        });

        expect(after.openPositions.eth).toBeUndefined();
        expect(after.closedPositions.eth).toBeUndefined();
        expect(after.openPositions.btc!.id).toBe(1);
    });

    it("BALANCE_UPDATED patches only the balance", () => {
        const before = stateWith({
            balance: "1000.00",
            openPositions: { btc: makePosition() },
        });

        const after = socketReducer(before, { type: "BALANCE_UPDATED", balance: "900.00" });

        expect(after.balance).toBe("900.00");
        expect(after.openPositions).toBe(before.openPositions);
    });
});

describe("POSITION_HISTORY_RESULT (closed position merging)", () => {
    it("sorts closed positions by closedAt, newest first", () => {
        const after = socketReducer(stateWith(), {
            type: "POSITION_HISTORY_RESULT",
            token: "btc",
            positions: [
                makeClosedPosition({ id: 1, closedAt: "2026-01-01T00:00:00.000Z" }),
                makeClosedPosition({ id: 2, closedAt: "2026-01-03T00:00:00.000Z" }),
                makeClosedPosition({ id: 3, closedAt: "2026-01-02T00:00:00.000Z" }),
            ],
        });

        expect(after.closedPositions.btc!.map((p) => p.id)).toEqual([2, 3, 1]);
    });

    it("keeps existing entries that are not in the incoming batch", () => {
        const before = stateWith({
            closedPositions: { btc: [makeClosedPosition({ id: 1 })] },
        });

        const after = socketReducer(before, {
            type: "POSITION_HISTORY_RESULT",
            token: "btc",
            positions: [makeClosedPosition({ id: 2, closedAt: "2026-01-05T00:00:00.000Z" })],
        });

        expect(after.closedPositions.btc!.map((p) => p.id).sort()).toEqual([1, 2]);
    });

    it("incoming data wins when the same id exists in both", () => {
        const before = stateWith({
            closedPositions: { btc: [makeClosedPosition({ id: 7, realizedPnl: "10.00" })] },
        });

        const after = socketReducer(before, {
            type: "POSITION_HISTORY_RESULT",
            token: "btc",
            positions: [makeClosedPosition({ id: 7, realizedPnl: "12.00" })],
        });

        expect(after.closedPositions.btc).toHaveLength(1);
        expect(after.closedPositions.btc![0]!.realizedPnl).toBe("12.00");
    });

    it("live close followed by the fetch result does not duplicate the position", () => {
        const closed = makeClosedPosition({ id: 7 });

        let state = socketReducer(stateWith(), {
            type: "TRADE_CONFIRM",
            payload: makeTradeConfirm({ id: 1, side: "sell", position: closed }),
        });
        state = socketReducer(state, {
            type: "POSITION_HISTORY_RESULT",
            token: "btc",
            positions: [closed],
        });

        expect(state.closedPositions.btc).toHaveLength(1);
    });

    it("fetch result followed by the live close does not duplicate the position", () => {
        const closed = makeClosedPosition({ id: 7 });

        let state = socketReducer(stateWith(), {
            type: "POSITION_HISTORY_RESULT",
            token: "btc",
            positions: [closed],
        });
        state = socketReducer(state, {
            type: "TRADE_CONFIRM",
            payload: makeTradeConfirm({ id: 1, side: "sell", position: closed }),
        });

        expect(state.closedPositions.btc).toHaveLength(1);
    });
});

describe("TRADE_HISTORY_RESULT (trade merging)", () => {
    it("merges the fetched history with live session trades without duplicates", () => {
        const live = makeTradeConfirm({ id: 3, createdAt: "2026-01-03T00:00:00.000Z" });
        let state = socketReducer(stateWith(), { type: "TRADE_CONFIRM", payload: live });

        state = socketReducer(state, {
            type: "TRADE_HISTORY_RESULT",
            token: "btc",
            trades: [
                makeTradeEntry({ id: 3, createdAt: "2026-01-03T00:00:00.000Z" }),
                makeTradeEntry({ id: 2, createdAt: "2026-01-02T00:00:00.000Z" }),
                makeTradeEntry({ id: 1, createdAt: "2026-01-01T00:00:00.000Z" }),
            ],
        });

        expect(state.trades.btc!.map((t) => t.id)).toEqual([3, 2, 1]);
    });

    it("only touches the token it was fetched for", () => {
        const before = stateWith({
            trades: { eth: [makeTradeEntry({ id: 50, token: "eth" })] },
        });

        const after = socketReducer(before, {
            type: "TRADE_HISTORY_RESULT",
            token: "btc",
            trades: [makeTradeEntry({ id: 1 })],
        });

        expect(after.trades.eth).toHaveLength(1);
        expect(after.trades.btc).toHaveLength(1);
    });

    it("HISTORY_RESULT stores the all-token history as-is", () => {
        const trades = [{ id: 1 }, { id: 2 }] as unknown as TradeRow[];
        const after = socketReducer(stateWith(), { type: "HISTORY_RESULT", trades });

        expect(after.tradeHistory).toBe(trades);
    });
});

describe("errors and rate limiting", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("RATE_LIMITED sets rateLimitedUntil to now + retryAfterMs", () => {
        const after = socketReducer(stateWith(), { type: "RATE_LIMITED", retryAfterMs: 5000 });

        expect(after.rateLimitedUntil).toBe(Date.now() + 5000);
    });

    it("SERVER_ERROR stores the error and CLEAR_ERROR removes it", () => {
        const error = { code: "INSUFFICIENT_BALANCE", message: "Not enough funds" };

        const withError = socketReducer(stateWith(), { type: "SERVER_ERROR", payload: error });
        expect(withError.lastError).toEqual(error);

        const cleared = socketReducer(withError, { type: "CLEAR_ERROR" });
        expect(cleared.lastError).toBeNull();
    });
});

describe("unknown actions", () => {
    it("returns the same state reference", () => {
        const state = stateWith();
        const next = socketReducer(state, { type: "NOT_A_REAL_ACTION" } as unknown as SocketAction);

        expect(next).toBe(state);
    });
});