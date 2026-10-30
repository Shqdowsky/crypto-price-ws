import http from "node:http";
import type { AddressInfo } from "node:net";
import { io as createClient, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CLIENT_EVENTS,
	type ClientToServerEvents,
	SERVER_EVENTS,
	type ServerToClientEvents,
	type SocketData,
	type AccountState,
	type AckResponse,
	type FundingRequest,
	type Position,
	type RoomName,
	type TokenPayload,
	type TradeConfirm,
	type TradeHistoryEntry,
	RATE_LIMIT,
	ROOMS,
} from "@crypto-price-ws/shared";
import pool from "../../src/config/db.js";
import { createTestUser, deleteTestUsers } from "../support/helpers.js";
import { attemptConnect, mintToken, TestClient } from "../support/socketHelper.js";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "../../src/socket/middleware/auth.middleware.js";
import { env } from "../../src/config/env.js";
import { setupSocketServer } from "../../src/socket/index.js";
import { notifyFundingReviewed } from "../../src/socket/notifier.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

type MockPrice = { price: number; PDChange: number; updatedAt: number };

const prices = vi.hoisted(() => new Map<string, MockPrice>());
const shutdown = vi.hoisted(() => ({ active: false }));

vi.mock("../../src/market/price-store.js", () => ({
	getPrice: (room: string) => prices.get(room),
	initTokenMap: () => undefined,
	startPriceLoop: () => undefined,
}));

vi.mock("../../src/socket/utils/shutdown.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../src/socket/utils/shutdown.js")>();
	return { ...actual, getIsShuttingDown: () => shutdown.active };
});

type PositionHistory = { token: RoomName; positions: Position[] };
type TradeHistory = { token: RoomName; trades: TradeHistoryEntry[] };
type Session = { client: TestClient; initialState: AccountState };

let httpServer: http.Server;
let io: AppServer;
let url: string;
let createdUserIds: number[] = [];
let openClients: TestClient[] = [];

function setPrice(token: string, price: number, PDChange = 0): void {
	prices.set(token, { price, PDChange, updatedAt: Date.now() });
}

async function newUser(balance = "1000.00"): Promise<number> {
	const id = await createTestUser(balance);
	createdUserIds.push(id);
	return id;
}

function createSocket(cookie: string): Socket {
	return createClient(url, {
		autoConnect: false,
		forceNew: true,
		reconnection: false,
		transports: ["websocket"],
		extraHeaders: { Cookie: cookie },
	});
}

// On connect the server joins every room, pushes price:current for the rooms that have a price,
// then pushes account:state. Events are queued by TestClient, so tests read them in any order.
async function connect(userId: number): Promise<Session> {
	const socket = createSocket(`token=${mintToken(userId)}`);
	const client = new TestClient(socket);
	openClients.push(client);

	const connected = new Promise<void>((resolve, reject) => {
		socket.once("connect", () => resolve());
		socket.once("connect_error", reject);
	});
	socket.connect();
	await connected;

	const initialState = await client.waitFor<AccountState>(SERVER_EVENTS.ACCOUNT_STATE);
	return { client, initialState };
}

function trade(client: TestClient, token: string, side: string, quantity: unknown) {
	return client.emit<TradeConfirm>(CLIENT_EVENTS.TRADE, { token, side, quantity });
}

function dataOf<T>(ack: AckResponse<T>): T {
	expect(ack.success, JSON.stringify(ack.error)).toBe(true);
	return ack.data as T;
}

function expectNoEvent(client: TestClient, event: string) {
	return expect(client.waitFor(event, 300)).rejects.toThrow(/Timed out/);
}

beforeAll(async () => {
	httpServer = http.createServer();
	io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
		cors: { origin: env.CLIENT_URL, credentials: true },
	});
	io.use(socketAuthMiddleware);
	setupSocketServer(io);
	await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
	url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

beforeEach(() => {
	prices.clear();
	shutdown.active = false;
	setPrice("sol", 70);
});

afterEach(async () => {
	for (const client of openClients) client.socket.disconnect();
	openClients = [];
	shutdown.active = false;
	await deleteTestUsers(createdUserIds);
	createdUserIds = [];
});

afterAll(async () => {
	await new Promise<void>((resolve) => io.close(() => resolve()));
	await pool.end();
});

describe("authentication", () => {
	it("rejects a connection with no cookie", async () => {
		expect(await attemptConnect(url)).toEqual({
			connected: false,
			errorMessage: "Not authenticated",
		});
	});

	it("rejects a cookie header that has no token cookie", async () => {
		const socket = createSocket("theme=dark");

		const errorMessage = await new Promise<string>((resolve, reject) => {
			socket.once("connect", () => reject(new Error("expected the connection to be rejected")));
			socket.once("connect_error", (err) => resolve(err.message));
			socket.connect();
		});
		socket.disconnect();

		expect(errorMessage).toBe("Authentication token missing");
	});

	it("rejects a malformed token", async () => {
		expect(await attemptConnect(url, "not-a-jwt")).toEqual({
			connected: false,
			errorMessage: "Invalid or expired token",
		});
	});

	it("rejects a token signed with the wrong secret", async () => {
		const userId = await newUser();
		const forged = mintToken(userId, { secret: "some-other-secret" });

		expect(await attemptConnect(url, forged)).toEqual({
			connected: false,
			errorMessage: "Invalid or expired token",
		});
	});

	it("rejects an expired token", async () => {
		const userId = await newUser();
		const expired = mintToken(userId, { expiredSecondsAgo: 60 });

		expect(await attemptConnect(url, expired)).toEqual({
			connected: false,
			errorMessage: "Invalid or expired token",
		});
	});

	it("rejects a validly signed token for a user that does not exist", async () => {
		expect(await attemptConnect(url, mintToken(2_147_483_000))).toEqual({
			connected: false,
			errorMessage: "User not found",
		});
	});

	it("accepts a valid token and pushes the account state", async () => {
		const userId = await newUser("1000.00");

		const { initialState } = await connect(userId);

		expect(initialState).toEqual({ balance: "1000.00", openPositions: [], closedPositions: [] });
	});
});

describe("connect snapshot", () => {
	it("pushes the current price of every room that has one, and nothing for the rest", async () => {
		setPrice("sol", 70, 1.5);
		setPrice("eth", 1700, -2);
		const userId = await newUser();
		const { client } = await connect(userId);

		const first = await client.waitFor<TokenPayload>(SERVER_EVENTS.PRICE_CURRENT);
		const second = await client.waitFor<TokenPayload>(SERVER_EVENTS.PRICE_CURRENT);
		const byToken = new Map([first, second].map((payload) => [payload.token, payload]));

		expect(byToken.get("sol")).toEqual({
			token: "sol",
			price: 70,
			PDChange: 1.5,
			timestamp: expect.any(Number),
		});
		expect(byToken.get("eth")).toEqual({
			token: "eth",
			price: 1700,
			PDChange: -2,
			timestamp: expect.any(Number),
		});
		await expectNoEvent(client, SERVER_EVENTS.PRICE_CURRENT);
	});

	it("pushes no prices when the market has none yet", async () => {
		prices.clear();
		const userId = await newUser();
		const { client } = await connect(userId);

		await expectNoEvent(client, SERVER_EVENTS.PRICE_CURRENT);
	});
});

describe("price:get", () => {
	it("returns the current price with its 24h change", async () => {
		setPrice("sol", 71.25, -3.4);
		const userId = await newUser();
		const { client } = await connect(userId);

		const payload = dataOf(await client.emit<TokenPayload>(CLIENT_EVENTS.GET_PRICE, "sol"));

		expect(payload).toEqual({
			token: "sol",
			price: 71.25,
			PDChange: -3.4,
			timestamp: expect.any(Number),
		});
	});

	it("rejects an unknown room", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);

		const ack = await client.emit(CLIENT_EVENTS.GET_PRICE, "nope");

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("INVALID_ROOM");
	});

	it("reports when a valid room has no price data", async () => {
		prices.delete("sol");
		const userId = await newUser();
		const { client } = await connect(userId);

		const ack = await client.emit(CLIENT_EVENTS.GET_PRICE, "sol");

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("NO_PRICE_DATA");
	});
});

describe("trade flow", () => {
	it("buy -> partial sell -> closing sell gives exact balances and realized P&L", async () => {
		const userId = await newUser("1000.00");
		const { client } = await connect(userId);

		setPrice("sol", 70);
		const buy = dataOf(await trade(client, "sol", "buy", 10));
		expect(buy.side).toBe("buy");
		expect(buy.position).toMatchObject({
			status: "open",
			quantity: "10.00000000",
			avgCostBasis: "70.00000000",
			realizedPnl: null,
		});
		expect(await client.waitFor<{ balance: string }>(SERVER_EVENTS.BALANCE_UPDATED)).toEqual({
			balance: "300.00",
		});

		setPrice("sol", 77);
		const partial = dataOf(await trade(client, "sol", "sell", 4));
		expect(partial.position).toMatchObject({
			status: "open",
			quantity: "6.00000000",
			totalSold: "4.00000000",
			avgCostBasis: "70.00000000",
			realizedPnl: null,
		});
		expect(await client.waitFor<{ balance: string }>(SERVER_EVENTS.BALANCE_UPDATED)).toEqual({
			balance: "608.00",
		});

		setPrice("sol", 80);
		const closing = dataOf(await trade(client, "sol", "sell", 6));
		expect(closing.position).toMatchObject({
			status: "closed",
			quantity: "0.00000000",
			totalSold: "10.00000000",
			avgSellPrice: "78.80000000",
			realizedPnl: "88.00",
		});
		expect(closing.position.closedAt).not.toBeNull();
		expect(await client.waitFor<{ balance: string }>(SERVER_EVENTS.BALANCE_UPDATED)).toEqual({
			balance: "1088.00",
		});

		const account = dataOf(await client.emit<AccountState>(CLIENT_EVENTS.GET_ACCOUNT_STATE));
		expect(account.balance).toBe("1088.00");
		expect(account.openPositions).toEqual([]);
		expect(account.closedPositions).toHaveLength(1);
		expect(account.closedPositions[0]!.id).toBe(closing.position.id);
	});

	it("trades at the price the market has at the moment of the request", async () => {
		const userId = await newUser("1000.00");
		const { client } = await connect(userId);

		setPrice("sol", 70);
		const first = dataOf(await trade(client, "sol", "buy", 1));
		setPrice("sol", 100);
		const second = dataOf(await trade(client, "sol", "buy", 1));

		expect(Number(first.price)).toBe(70);
		expect(Number(second.price)).toBe(100);
		expect(second.position).toMatchObject({ quantity: "2.00000000", avgCostBasis: "85.00000000" });
	});

	it("restores balance and open positions on a fresh connection", async () => {
		const userId = await newUser("1000.00");
		const first = await connect(userId);

		dataOf(await trade(first.client, "sol", "buy", 5));
		first.client.socket.disconnect();

		const second = await connect(userId);

		expect(second.initialState.balance).toBe("650.00");
		expect(second.initialState.openPositions).toHaveLength(1);
		expect(second.initialState.openPositions[0]).toMatchObject({
			token: "sol",
			quantity: "5.00000000",
		});
	});

	it("buy all spends the whole balance without rounding errors, sell all closes the position", async () => {
		const userId = await newUser("1000.00");
		const { client } = await connect(userId);

		const buy = dataOf(await trade(client, "sol", "buy", "all"));
		expect(buy.position).toMatchObject({ status: "open", quantity: "14.28571428" });
		expect(await client.waitFor<{ balance: string }>(SERVER_EVENTS.BALANCE_UPDATED)).toEqual({
			balance: "0.00",
		});

		setPrice("sol", 80);
		const sell = dataOf(await trade(client, "sol", "sell", "all"));
		expect(sell.position).toMatchObject({ status: "closed", quantity: "0.00000000" });
		expect(await client.waitFor<{ balance: string }>(SERVER_EVENTS.BALANCE_UPDATED)).toEqual({
			balance: "1142.86",
		});
	});
});

describe("trade rejections (through the real handler)", () => {
	it.each([
		["an unknown token", { token: "nope", side: "buy", quantity: 1 }, "INVALID_ROOM"],
		["an unknown side", { token: "sol", side: "hold", quantity: 1 }, "INVALID_SIDE"],
		["a zero quantity", { token: "sol", side: "buy", quantity: 0 }, "INVALID_QUANTITY"],
		["a negative quantity", { token: "sol", side: "buy", quantity: -1 }, "INVALID_QUANTITY"],
		["a string quantity", { token: "sol", side: "buy", quantity: "5" }, "INVALID_QUANTITY"],
		["a null quantity", { token: "sol", side: "buy", quantity: null }, "INVALID_QUANTITY"],
		["a missing quantity", { token: "sol", side: "buy" }, "INVALID_QUANTITY"],
	])("rejects %s with %s", async (_label, payload, code) => {
		const userId = await newUser();
		const { client } = await connect(userId);

		const ack = await client.emit(CLIENT_EVENTS.TRADE, payload);

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe(code);
	});

	it("sell all with no open position is rejected", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);

		const ack = await trade(client, "sol", "sell", "all");

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("NO_OPEN_POSITION");
	});

	it("buy all with a zero balance is rejected", async () => {
		const userId = await newUser("0.00");
		const { client } = await connect(userId);

		const ack = await trade(client, "sol", "buy", "all");

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("INSUFFICIENT_BALANCE");
	});

	it("rejects a trade when no price is available for the token", async () => {
		prices.delete("sol");
		const userId = await newUser();
		const { client } = await connect(userId);

		const ack = await trade(client, "sol", "buy", 1);

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("PRICE_UNAVAILABLE");
	});

	it("rejects a sell with no open position", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);

		const ack = await trade(client, "sol", "sell", 1);

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("NO_OPEN_POSITION");
	});

	it("rejects an oversell and leaves balance and position untouched", async () => {
		const userId = await newUser("1000.00");
		const { client } = await connect(userId);
		dataOf(await trade(client, "sol", "buy", 1));

		const ack = await trade(client, "sol", "sell", 2);

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("SELL_EXCEEDS_POSITION");

		const account = dataOf(await client.emit<AccountState>(CLIENT_EVENTS.GET_ACCOUNT_STATE));
		expect(account.balance).toBe("930.00");
		expect(account.openPositions[0]).toMatchObject({ quantity: "1.00000000" });
	});

	it("rejects a buy the balance cannot cover", async () => {
		const userId = await newUser("100.00");
		const { client } = await connect(userId);

		const ack = await trade(client, "sol", "buy", 10);

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("INSUFFICIENT_BALANCE");
	});

	it("rejects trades while the server is shutting down and changes nothing", async () => {
		const userId = await newUser("1000.00");
		const { client } = await connect(userId);

		shutdown.active = true;
		const ack = await trade(client, "sol", "buy", 1);
		shutdown.active = false;

		expect(ack.success).toBe(false);
		expect(ack.error?.code).toBe("SERVER_SHUTTING_DOWN");

		const account = dataOf(await client.emit<AccountState>(CLIENT_EVENTS.GET_ACCOUNT_STATE));
		expect(account.balance).toBe("1000.00");
		expect(account.openPositions).toEqual([]);
	});
});

describe("history acks", () => {
	it("returns only the caller's data, scoped to the requested token", async () => {
		const userA = await newUser("5000.00");
		const userB = await newUser("5000.00");
		const a = (await connect(userA)).client;
		const b = (await connect(userB)).client;

		setPrice("sol", 70);
		dataOf(await trade(a, "sol", "buy", 2));
		setPrice("sol", 80);
		dataOf(await trade(a, "sol", "sell", 2));

		setPrice("eth", 1700);
		dataOf(await trade(a, "eth", "buy", 1));
		setPrice("eth", 1800);
		dataOf(await trade(a, "eth", "sell", 1));

		setPrice("sol", 70);
		dataOf(await trade(b, "sol", "buy", 1));
		setPrice("sol", 90);
		dataOf(await trade(b, "sol", "sell", 1));

		const aSolPositions = dataOf(
			await a.emit<PositionHistory>(CLIENT_EVENTS.GET_POSITION_HISTORY, { token: "sol" }),
		);
		expect(aSolPositions.token).toBe("sol");
		expect(aSolPositions.positions).toHaveLength(1);
		expect(aSolPositions.positions[0]).toMatchObject({
			token: "sol",
			status: "closed",
			realizedPnl: "20.00",
		});

		const aEthPositions = dataOf(
			await a.emit<PositionHistory>(CLIENT_EVENTS.GET_POSITION_HISTORY, { token: "eth" }),
		);
		expect(aEthPositions.positions).toHaveLength(1);
		expect(aEthPositions.positions[0]).toMatchObject({ realizedPnl: "100.00" });

		const bEthPositions = dataOf(
			await b.emit<PositionHistory>(CLIENT_EVENTS.GET_POSITION_HISTORY, { token: "eth" }),
		);
		expect(bEthPositions.positions).toEqual([]);

		const aSolTrades = dataOf(
			await a.emit<TradeHistory>(CLIENT_EVENTS.GET_TRADE_HISTORY, { token: "sol" }),
		);
		expect(aSolTrades.trades.map((t) => t.side)).toEqual(["sell", "buy"]);
		expect(aSolTrades.trades.map((t) => Number(t.quantity))).toEqual([2, 2]);
		expect(aSolTrades.trades.map((t) => Number(t.price))).toEqual([80, 70]);

		const bSolTrades = dataOf(
			await b.emit<TradeHistory>(CLIENT_EVENTS.GET_TRADE_HISTORY, { token: "sol" }),
		);
		expect(bSolTrades.trades).toHaveLength(2);
	});

	it("returns empty histories for a token the user never traded", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);

		const positions = dataOf(
			await client.emit<PositionHistory>(CLIENT_EVENTS.GET_POSITION_HISTORY, { token: "btc" }),
		);
		const trades = dataOf(
			await client.emit<TradeHistory>(CLIENT_EVENTS.GET_TRADE_HISTORY, { token: "btc" }),
		);

		expect(positions).toEqual({ token: "btc", positions: [] });
		expect(trades).toEqual({ token: "btc", trades: [] });
	});

	it.each([CLIENT_EVENTS.GET_POSITION_HISTORY, CLIENT_EVENTS.GET_TRADE_HISTORY])(
		"%s rejects an unknown token",
		async (event) => {
			const userId = await newUser();
			const { client } = await connect(userId);

			const ack = await client.emit(event, { token: "nope" });

			expect(ack.success).toBe(false);
			expect(ack.error?.code).toBe("INVALID_ROOM");
		},
	);
});

describe("rooms", () => {
	it("joins every room on connect, so a broadcast to any token room arrives", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);
		const tokens = Object.values(ROOMS);

		for (const token of tokens) {
			io.to(token).emit(SERVER_EVENTS.PRICE_UPDATE, { token, price: 1, PDChange: 0, timestamp: 1 });
		}

		const received: string[] = [];
		for (let i = 0; i < tokens.length; i++) {
			received.push((await client.waitFor<TokenPayload>(SERVER_EVENTS.PRICE_UPDATE)).token);
		}
		expect(received.sort()).toEqual([...tokens].sort());
	});
});

describe("user notifications", () => {
	const request: FundingRequest = {
		id: 1,
		amount: "250.00",
		status: "approved",
		reason: null,
		createdAt: new Date().toISOString(),
		reviewedAt: new Date().toISOString(),
	};

	it("delivers a reviewed funding request and the new balance only to that user", async () => {
		const userId = await newUser();
		const otherId = await newUser();
		const { client } = await connect(userId);
		const other = await connect(otherId);

		notifyFundingReviewed(userId, request, "1250.00");

		expect(
			await client.waitFor<{ request: FundingRequest }>(SERVER_EVENTS.FUNDING_REVIEWED),
		).toEqual({ request });
		expect(await client.waitFor<{ balance: string }>(SERVER_EVENTS.BALANCE_UPDATED)).toEqual({
			balance: "1250.00",
		});
		await expectNoEvent(other.client, SERVER_EVENTS.FUNDING_REVIEWED);
		await expectNoEvent(other.client, SERVER_EVENTS.BALANCE_UPDATED);
	});

	it("sends no balance update when the request was not approved", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);
		const rejected: FundingRequest = { ...request, status: "rejected", reason: "Not verified" };

		notifyFundingReviewed(userId, rejected);

		expect(
			await client.waitFor<{ request: FundingRequest }>(SERVER_EVENTS.FUNDING_REVIEWED),
		).toEqual({ request: rejected });
		await expectNoEvent(client, SERVER_EVENTS.BALANCE_UPDATED);
	});
});

describe("rate limiting", () => {
	it("throttles after MAX_REQUESTS, then recovers as the bucket refills", async () => {
		const userId = await newUser();
		const { client } = await connect(userId);

		const acks = await Promise.all(
			Array.from({ length: RATE_LIMIT.MAX_REQUESTS + 1 }, () =>
				client.emit(CLIENT_EVENTS.GET_ACCOUNT_STATE),
			),
		);

		const allowed = acks.filter((a) => a.success);
		const rejected = acks.filter((a) => !a.success);

		expect(allowed).toHaveLength(RATE_LIMIT.MAX_REQUESTS);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]!.error?.code).toBe("RATE_LIMITED");

		const event = await client.waitFor<{ retryAfterMs: number }>(SERVER_EVENTS.RATE_LIMITED);
		expect(event.retryAfterMs).toBeGreaterThan(0);

		await new Promise((resolve) => setTimeout(resolve, 1100));
		const afterRefill = await client.emit(CLIENT_EVENTS.GET_ACCOUNT_STATE);
		expect(afterRefill.success).toBe(true);
	});

	it("is tracked per user: a second socket shares the bucket, other users are unaffected", async () => {
		const userId = await newUser();
		const otherId = await newUser();
		const first = await connect(userId);
		const second = await connect(userId);
		const other = await connect(otherId);

		const burst = await Promise.all(
			Array.from({ length: RATE_LIMIT.MAX_REQUESTS }, () =>
				first.client.emit(CLIENT_EVENTS.GET_ACCOUNT_STATE),
			),
		);
		expect(burst.every((ack) => ack.success)).toBe(true);

		const sameUserOtherSocket = await second.client.emit(CLIENT_EVENTS.GET_ACCOUNT_STATE);
		expect(sameUserOtherSocket.success).toBe(false);
		expect(sameUserOtherSocket.error?.code).toBe("RATE_LIMITED");

		const otherUser = await other.client.emit(CLIENT_EVENTS.GET_ACCOUNT_STATE);
		expect(otherUser.success).toBe(true);
	});
});
