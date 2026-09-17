import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";
import { initialSocketState, socketReducer, type SocketState } from "./socketReducer";
import { io, type Socket } from "socket.io-client";
import { CLIENT_EVENTS, SERVER_EVENTS, type ClientToServerEvents, type RoomName, type ServerToClientEvents } from "@crypto-price-ws/shared";


const WS_URL = import.meta.env.VITE_SERVER_URL;

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
interface SocketContextValue {
    state: SocketState;
    joinRoom: (room: RoomName) => void;
    leaveRoom: (room: RoomName) => void;
    getPrice: (room: RoomName) => void;
    trade: (token: RoomName, side: "buy" | "sell") => void;
    fetchHistory: () => void;
}

const SocketContext  = createContext<SocketContextValue | null>(null);

export function SocketProvider({children}: {children: React.ReactNode}){
    const [state, dispatch] = useReducer(socketReducer, initialSocketState)
    const socketRef = useRef<ClientSocket | null>(null);

    useEffect( () => {
        dispatch({type: "CONNECTING"});

        const socket: ClientSocket = io(WS_URL, {
            withCredentials: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            dispatch({type: "CONNECTED"});
        })

        socket.on("disconnect", () => {
            dispatch({ type: "DISCONNECTED" });
        });

        socket.io.on("reconnect_attempt", () => {
            dispatch({ type: "RECONNECTING" });
        });

        socket.on(SERVER_EVENTS.PRICE_UPDATE, (payload) => {
            dispatch({ type: "PRICE_UPDATE", payload });
        });

        socket.on(SERVER_EVENTS.PRICE_CURRENT, (payload) => {
            dispatch({ type: "PRICE_CURRENT", payload });
        });

        socket.on(SERVER_EVENTS.TRADE_CONFIRM, (payload) => {
            dispatch({ type: "TRADE_CONFIRM", payload });
        });

        socket.on(SERVER_EVENTS.HISTORY_RESULT, (payload) => {
            dispatch({ type: "HISTORY_RESULT", trades: payload.trades });
        });

        socket.on(SERVER_EVENTS.RATE_LIMITED, (payload) => {
            dispatch({ type: "RATE_LIMITED", retryAfterMs: payload.retryAfterMs });
        });

        socket.on(SERVER_EVENTS.ERROR, (payload) => {
            dispatch({ type: "SERVER_ERROR", payload });
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [])

    const joinRoom = useCallback((room: RoomName) => {
        socketRef.current?.emit(CLIENT_EVENTS.SUBSCRIBE, room);
        dispatch({ type: "ROOM_JOINED", room });
    }, []);

    const leaveRoom = useCallback((room: RoomName) => {
        socketRef.current?.emit(CLIENT_EVENTS.UNSUBSCRIBE, room);
        dispatch({ type: "ROOM_LEFT", room });
    }, []);

    const getPrice = useCallback((room: RoomName) => {
        socketRef.current?.emit(CLIENT_EVENTS.GET_PRICE, room);
    }, []);

    const trade = useCallback((token: RoomName, side: "buy" | "sell") => {
        socketRef.current?.emit(CLIENT_EVENTS.TRADE, { token, side });
    }, []);

    const fetchHistory = useCallback(() => {
        socketRef.current?.emit(CLIENT_EVENTS.HISTORY);
    }, []);

    return (
        <SocketContext.Provider value={{ state, joinRoom, leaveRoom, getPrice, trade, fetchHistory }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext );

  if (!context) {
    throw new Error(
      "useSocketContext must be used inside SocketProvider"
    );
  }

  return context;
}