import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";
import { initialSocketState, socketReducer, type SocketState } from "./socketReducer";
import { io, type Socket } from "socket.io-client";
import { CLIENT_EVENTS, SERVER_EVENTS, type AckResponse, type ClientToServerEvents, type RoomName, type ServerToClientEvents } from "@crypto-price-ws/shared";


const WS_URL = import.meta.env.VITE_SERVER_URL;
const ACK_TIMEOUT_MS = import.meta.env.ACK_TIMEOUT_MS;

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

    const joinRoom = useCallback( async (room: RoomName) => {
        if (!socketRef.current) return;
        try{
            const res: AckResponse = await socketRef.current
                .timeout(ACK_TIMEOUT_MS)
                .emitWithAck(CLIENT_EVENTS.SUBSCRIBE, room);
        
            if (!res.success) {
                if (res.error) dispatch({ type: "SERVER_ERROR", payload: res.error });
                return;
            }

            dispatch({ type: "ROOM_JOINED", room });
            dispatch({ type: "CLEAR_ERROR" });
        } catch{
            dispatch({
                type: "SERVER_ERROR",
                payload: { code: "TIMEOUT", message: "Server did not respond to join request" },
            });
        }
    }, []);

    const leaveRoom = useCallback(async(room: RoomName) => {
        if (!socketRef.current) return;

        try{
            const res: AckResponse = await socketRef.current
                .timeout(ACK_TIMEOUT_MS)
                .emitWithAck(CLIENT_EVENTS.UNSUBSCRIBE, room);
            
            if (!res.success) {
                if (res.error) dispatch({ type: "SERVER_ERROR", payload: res.error });
                return;
            }
            dispatch({ type: "ROOM_LEFT", room });
        }catch{
            dispatch({
                type: "SERVER_ERROR",
                payload: { code: "TIMEOUT", message: "Server did not respond to leave request" },
            });
        }
    }, []);

    const getPrice = useCallback(async (room: RoomName) => {
        if (!socketRef.current) return;

        try {
            const res = await socketRef.current
                .timeout(ACK_TIMEOUT_MS)
                .emitWithAck(CLIENT_EVENTS.GET_PRICE, room);

            if (!res.success) {
                if (res.error) dispatch({ type: "SERVER_ERROR", payload: res.error });
                return;
            }

            if (res.data) dispatch({ type: "PRICE_CURRENT", payload: res.data });
        } catch {
            dispatch({
                type: "SERVER_ERROR",
                payload: { code: "TIMEOUT", message: "Server did not respond to price request" },
            });
        }
    }, []);

    const trade = useCallback(async (token: RoomName, side: "buy" | "sell") => {
        if (!socketRef.current) return null;

        try {
            const res = await socketRef.current
                .timeout(ACK_TIMEOUT_MS)
                .emitWithAck(CLIENT_EVENTS.TRADE, { token, side });

            if (!res.success) {
                if (res.error) dispatch({ type: "SERVER_ERROR", payload: res.error });
                return null;
            }

            if (res.data) dispatch({ type: "TRADE_CONFIRM", payload: res.data });
            return res.data ?? null;
        } catch {
            dispatch({
                type: "SERVER_ERROR",
                payload: { code: "TIMEOUT", message: "Server did not respond to trade request" },
            });
            return null;
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        if (!socketRef.current) return;

        try {
            const res = await socketRef.current
                .timeout(ACK_TIMEOUT_MS)
                .emitWithAck(CLIENT_EVENTS.HISTORY);

            if (!res.success) {
                if (res.error) dispatch({ type: "SERVER_ERROR", payload: res.error });
                return;
            }

            if (res.data) dispatch({ type: "HISTORY_RESULT", trades: res.data.trades });
        } catch {
            dispatch({
                type: "SERVER_ERROR",
                payload: { code: "TIMEOUT", message: "Server did not respond to history request" },
            });
        }
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