import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import type { UnknownAction } from "@reduxjs/toolkit";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
	CLIENT_EVENTS,
	SERVER_EVENTS,
	type AckResponse,
	type ClientToServerEvents,
	type FundingRequest,
	type RoomName,
	type ServerToClientEvents,
	type TradeConfirm,
} from "@crypto-price-ws/shared";
import { MY_FUNDING_KEY } from "../../hooks/fundingQueries";
import { socketActions, type SocketState } from "./socketReducer";
import { createSocketStore, type AppDispatch, type RootState } from "./store";

const WS_URL = import.meta.env.VITE_SERVER_URL;
const ACK_TIMEOUT_MS = Number(import.meta.env.VITE_ACK_TIMEOUT_MS) || 5000;

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type TimedSocket = ReturnType<ClientSocket["timeout"]>;

interface SocketContextValue {
	getPrice: (room: RoomName) => void;
	trade: (
		token: RoomName,
		side: "buy" | "sell",
		quantity: number | "all",
	) => Promise<TradeConfirm | null>;
	fetchHistory: () => void;
	getAccountState: () => void;
	getPositionHistory: (token: RoomName) => void;
	getTradeHistory: (token: RoomName) => void;
	fundingNotice: FundingRequest | null;
	dismissFundingNotice: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);
let pendingSocketPromise: Promise<ClientSocket> | null = null;

function waitForConnection(getSocket: () => ClientSocket | null): Promise<ClientSocket> {
	const socket = getSocket();

	if (socket?.connected) {
		return Promise.resolve(socket);
	}

	if (pendingSocketPromise) {
		return pendingSocketPromise;
	}
	pendingSocketPromise = new Promise((resolve) => {
		const check = () => {
			const socket = getSocket();
			if (socket?.connected) {
				resolve(socket);
			} else if (socket) {
				socket.once("connect", () => resolve(socket));
			} else {
				setTimeout(check, 20);
			}
		};
		check();
	});
	pendingSocketPromise.then(() => {
		pendingSocketPromise = null;
	});

	return pendingSocketPromise;
}

async function ackRequest<T>(
	getSocket: () => ClientSocket | null,
	dispatch: AppDispatch,
	send: (socket: TimedSocket) => Promise<AckResponse<T>>,
	timeoutMessage: string,
	onData: (data: T) => UnknownAction,
): Promise<T | null> {
	const socket = await waitForConnection(getSocket);

	try {
		const res = await send(socket.timeout(ACK_TIMEOUT_MS));

		if (!res.success) {
			if (res.error) dispatch(socketActions.serverError(res.error));
			return null;
		}

		if (!res.data) return null;
		dispatch(onData(res.data));
		return res.data;
	} catch {
		dispatch(socketActions.serverError({ code: "TIMEOUT", message: timeoutMessage }));
		return null;
	}
}

function SocketBridge({ children }: { children: React.ReactNode }) {
	const dispatch = useDispatch<AppDispatch>();
	const queryClient = useQueryClient();
	const [fundingNotice, setFundingNotice] = useState<FundingRequest | null>(null);
	const dismissFundingNotice = useCallback(() => setFundingNotice(null), []);
	const socketRef = useRef<ClientSocket | null>(null);

	useEffect(() => {
		dispatch(socketActions.connecting());

		const socket: ClientSocket = io(WS_URL, {
			withCredentials: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
		});

		socketRef.current = socket;

		socket.on("connect", () => dispatch(socketActions.connected()));
		socket.on("disconnect", () => dispatch(socketActions.disconnected()));
		socket.io.on("reconnect_attempt", () => dispatch(socketActions.reconnecting()));

		socket.on(SERVER_EVENTS.PRICE_UPDATE, (payload) =>
			dispatch(socketActions.priceUpdate(payload)),
		);
		socket.on(SERVER_EVENTS.PRICE_CURRENT, (payload) =>
			dispatch(socketActions.priceCurrent(payload)),
		);
		socket.on(SERVER_EVENTS.TRADE_CONFIRM, (payload) =>
			dispatch(socketActions.tradeConfirm(payload)),
		);
		socket.on(SERVER_EVENTS.HISTORY_RESULT, (payload) =>
			dispatch(socketActions.historyResult(payload)),
		);
		socket.on(SERVER_EVENTS.BALANCE_UPDATED, (payload) =>
			dispatch(socketActions.balanceUpdated(payload.balance)),
		);
		socket.on(SERVER_EVENTS.ACCOUNT_STATE, (payload) =>
			dispatch(socketActions.accountState(payload)),
		);
		socket.on(SERVER_EVENTS.FUNDING_REVIEWED, ({ request }) => {
			setFundingNotice(request);
			void queryClient.invalidateQueries({ queryKey: MY_FUNDING_KEY });
		});
		socket.on(SERVER_EVENTS.RATE_LIMITED, (payload) =>
			dispatch(socketActions.rateLimited(payload.retryAfterMs)),
		);
		socket.on(SERVER_EVENTS.ERROR, (payload) => dispatch(socketActions.serverError(payload)));

		return () => {
			socket.disconnect();
			socketRef.current = null;
		};
	}, [dispatch, queryClient]);

	const request = useCallback(
		<T,>(
			send: (socket: TimedSocket) => Promise<AckResponse<T>>,
			timeoutMessage: string,
			onData: (data: T) => UnknownAction,
		) => ackRequest(() => socketRef.current, dispatch, send, timeoutMessage, onData),
		[dispatch],
	);

	const getPrice = useCallback(
		(room: RoomName) => {
			void request(
				(s) => s.emitWithAck(CLIENT_EVENTS.GET_PRICE, room),
				"Server did not respond to price request",
				socketActions.priceCurrent,
			);
		},
		[request],
	);

	const trade = useCallback(
		(token: RoomName, side: "buy" | "sell", quantity: number | "all") => {
			dispatch(socketActions.clearError());
			return request(
				(s) => s.emitWithAck(CLIENT_EVENTS.TRADE, { token, side, quantity }),
				"Server did not respond to trade request",
				socketActions.tradeConfirm,
			);
		},
		[dispatch, request],
	);

	const fetchHistory = useCallback(() => {
		void request(
			(s) => s.emitWithAck(CLIENT_EVENTS.HISTORY),
			"Server did not respond to history request",
			socketActions.historyResult,
		);
	}, [request]);

	const getAccountState = useCallback(() => {
		void request(
			(s) => s.emitWithAck(CLIENT_EVENTS.GET_ACCOUNT_STATE),
			"Server did not respond to account state request",
			socketActions.accountState,
		);
	}, [request]);

	const getPositionHistory = useCallback(
		(token: RoomName) => {
			void request(
				(s) => s.emitWithAck(CLIENT_EVENTS.GET_POSITION_HISTORY, { token }),
				"Server did not respond to position history request",
				socketActions.positionHistoryResult,
			);
		},
		[request],
	);

	const getTradeHistory = useCallback(
		(token: RoomName) => {
			void request(
				(s) => s.emitWithAck(CLIENT_EVENTS.GET_TRADE_HISTORY, { token }),
				"Server did not respond to trade history request",
				socketActions.tradeHistoryResult,
			);
		},
		[request],
	);

	return (
		<SocketContext.Provider
			value={{
				getPrice,
				trade,
				fetchHistory,
				getAccountState,
				getPositionHistory,
				getTradeHistory,
				fundingNotice,
				dismissFundingNotice,
			}}
		>
			{children}
		</SocketContext.Provider>
	);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
	const [store] = useState(createSocketStore);

	return (
		<Provider store={store}>
			<SocketBridge>{children}</SocketBridge>
		</Provider>
	);
}

// Subscribes to a slice of the socket state; re-renders only when the selected value changes.
// Return existing references (e.g. `s.prices[token]`), not freshly built objects or arrays.
// eslint-disable-next-line react-refresh/only-export-components
export function useSocketSelector<T>(selector: (state: SocketState) => T): T {
	return useSelector((root: RootState) => selector(root.socket));
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocketContext(): SocketContextValue {
	const context = useContext(SocketContext);

	if (!context) {
		throw new Error("useSocketContext must be used inside SocketProvider");
	}

	return context;
}
