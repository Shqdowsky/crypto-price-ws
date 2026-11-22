import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@crypto-price-ws/shared";
import type { SocketState } from "./socketReducer";
import { SocketProvider, useSocketContext, useSocketSelector } from "./SocketProvider";

type Handler = (...args: unknown[]) => void;

const h = vi.hoisted(() => {
	const emitWithAck = vi.fn();
	const handlers = new Map<string, Handler>();
	const ioHandlers = new Map<string, Handler>();
	const socket = {
		connected: true,
		on: vi.fn((event: string, fn: Handler) => {
			handlers.set(event, fn);
			return socket;
		}),
		once: vi.fn(),
		disconnect: vi.fn(),
		timeout: vi.fn(() => ({ emitWithAck })),
		io: { on: (event: string, fn: Handler) => ioHandlers.set(event, fn) },
	};
	return { emitWithAck, handlers, ioHandlers, socket };
});

vi.mock("socket.io-client", () => ({ io: vi.fn(() => h.socket) }));

const confirm = {
	id: 1,
	token: "btc",
	side: "buy",
	price: "1",
	quantity: "1",
	createdAt: "2026-01-01T00:00:00Z",
	position: { id: 1, token: "btc", status: "open" },
};
const tradeArgs = ["btc", "buy", 1] as const;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

// Minimal renderHook: mounts the hook under the real provider and exposes its latest value.
function setup() {
	const result = {
		current: null as unknown as ReturnType<typeof useSocketContext> & { state: SocketState },
	};
	function Probe() {
		const state = useSocketSelector((s) => s);
		result.current = { ...useSocketContext(), state };
		return null;
	}
	act(() => {
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<SocketProvider>
					<Probe />
				</SocketProvider>
			</QueryClientProvider>,
		);
	});
	return { result };
}

describe("SocketProvider", () => {
	beforeEach(() => {
		h.emitWithAck.mockReset();
		h.handlers.clear();
		h.ioHandlers.clear();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it("tracks the connection status from socket events", () => {
		const { result } = setup();
		expect(result.current.state.connectionStatus).toBe("connecting");

		act(() => h.handlers.get("connect")!());
		expect(result.current.state.connectionStatus).toBe("connected");

		act(() => h.ioHandlers.get("reconnect_attempt")!());
		expect(result.current.state.connectionStatus).toBe("reconnecting");

		act(() => h.handlers.get("disconnect")!());
		expect(result.current.state.connectionStatus).toBe("disconnected");
	});

	it("stores pushed server events in the store", () => {
		const { result } = setup();

		act(() => {
			h.handlers.get(SERVER_EVENTS.PRICE_UPDATE)!({
				token: "btc",
				price: 1,
				PDChange: 0,
				timestamp: 1,
			});
			h.handlers.get(SERVER_EVENTS.BALANCE_UPDATED)!({ balance: "42.00" });
		});

		expect(result.current.state.prices.btc?.price).toBe(1);
		expect(result.current.state.balance).toBe("42.00");
	});

	it("shows the funding notice from FUNDING_REVIEWED and dismisses it", () => {
		const { result } = setup();
		const request = { id: 1 };

		act(() => h.handlers.get(SERVER_EVENTS.FUNDING_REVIEWED)!({ request }));
		expect(result.current.fundingNotice).toEqual(request);

		act(() => result.current.dismissFundingNotice());
		expect(result.current.fundingNotice).toBeNull();
	});

	it("trade resolves the data and stores the confirmation", async () => {
		h.emitWithAck.mockResolvedValue({ success: true, data: confirm });
		const { result } = setup();

		let out;
		await act(async () => {
			out = await result.current.trade(...tradeArgs);
		});

		expect(h.emitWithAck).toHaveBeenCalledWith(CLIENT_EVENTS.TRADE, {
			token: "btc",
			side: "buy",
			quantity: 1,
		});
		expect(out).toEqual(confirm);
		expect(result.current.state.trades.btc).toHaveLength(1);
	});

	it("trade clears the previous error before emitting", async () => {
		h.emitWithAck.mockResolvedValue({ success: false });
		const { result } = setup();
		act(() => h.handlers.get(SERVER_EVENTS.ERROR)!({ code: "X", message: "old" }));
		expect(result.current.state.lastError).not.toBeNull();

		await act(async () => {
			await result.current.trade(...tradeArgs);
		});

		expect(result.current.state.lastError).toBeNull();
	});

	it("a failed ack with an error stores it and resolves null", async () => {
		const error = { code: "INSUFFICIENT_FUNDS", message: "no money" };
		h.emitWithAck.mockResolvedValue({ success: false, error });
		const { result } = setup();

		let out;
		await act(async () => {
			out = await result.current.trade(...tradeArgs);
		});

		expect(out).toBeNull();
		expect(result.current.state.lastError).toEqual(error);
	});

	it("a failed ack without an error changes nothing and resolves null", async () => {
		h.emitWithAck.mockResolvedValue({ success: false });
		const { result } = setup();

		let out;
		await act(async () => {
			out = await result.current.trade(...tradeArgs);
		});

		expect(out).toBeNull();
		expect(result.current.state.lastError).toBeNull();
	});

	it("a rejected ack becomes a TIMEOUT error with the request-specific message", async () => {
		h.emitWithAck.mockRejectedValue(new Error("timeout"));
		const { result } = setup();

		await act(async () => {
			await result.current.trade(...tradeArgs);
		});

		expect(result.current.state.lastError).toEqual({
			code: "TIMEOUT",
			message: "Server did not respond to trade request",
		});
	});

	type State = SocketState;
	it.each([
		[
			"getPrice",
			["btc"],
			CLIENT_EVENTS.GET_PRICE,
			["btc"],
			{ token: "btc", price: 1, PDChange: 0, timestamp: 1 },
			(s: State) => s.prices.btc?.price,
			1,
		],
		[
			"fetchHistory",
			[],
			CLIENT_EVENTS.HISTORY,
			[],
			{ trades: [{ id: 1 }] },
			(s: State) => s.tradeHistory.length,
			1,
		],
		[
			"getAccountState",
			[],
			CLIENT_EVENTS.GET_ACCOUNT_STATE,
			[],
			{ balance: "9.00", openPositions: [], closedPositions: [] },
			(s: State) => s.balance,
			"9.00",
		],
		[
			"getPositionHistory",
			["btc"],
			CLIENT_EVENTS.GET_POSITION_HISTORY,
			[{ token: "btc" }],
			{ token: "btc", positions: [{ id: 1, closedAt: null }] },
			(s: State) => s.closedPositions.btc?.length,
			1,
		],
		[
			"getTradeHistory",
			["btc"],
			CLIENT_EVENTS.GET_TRADE_HISTORY,
			[{ token: "btc" }],
			{ token: "btc", trades: [{ id: 1, createdAt: "2026-01-01" }] },
			(s: State) => s.trades.btc?.length,
			1,
		],
	] as const)(
		"%s emits its event and stores the result",
		async (name, args, event, payload, data, select, expected) => {
			h.emitWithAck.mockResolvedValue({ success: true, data });
			const { result } = setup();

			await act(async () => {
				(result.current[name] as (...a: unknown[]) => void)(...args);
			});

			expect(h.emitWithAck).toHaveBeenCalledWith(event, ...payload);
			expect(select(result.current.state)).toBe(expected);
		},
	);

	it("a component selecting only the balance does not re-render on price ticks", () => {
		let renders = 0;
		function BalanceOnly() {
			renders++;
			return <span>{useSocketSelector((s) => s.balance)}</span>;
		}
		act(() => {
			root.render(
				<QueryClientProvider client={new QueryClient()}>
					<SocketProvider>
						<BalanceOnly />
					</SocketProvider>
				</QueryClientProvider>,
			);
		});
		const before = renders;

		act(() => {
			h.handlers.get(SERVER_EVENTS.PRICE_UPDATE)!({
				token: "btc",
				price: 1,
				PDChange: 0,
				timestamp: 1,
			});
			h.handlers.get(SERVER_EVENTS.PRICE_UPDATE)!({
				token: "btc",
				price: 2,
				PDChange: 0,
				timestamp: 2,
			});
		});
		expect(renders).toBe(before);

		act(() => h.handlers.get(SERVER_EVENTS.BALANCE_UPDATED)!({ balance: "5.00" }));
		expect(renders).toBe(before + 1);
		expect(container.textContent).toBe("5.00");
	});

	it("throws when used outside the provider", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		function Bare() {
			useSocketContext();
			return null;
		}
		expect(() => act(() => root.render(<Bare />))).toThrow(/inside SocketProvider/);
	});
});
