import type { Socket } from "socket.io";
import { CLIENT_EVENTS, SERVER_EVENTS, VALID_ROOMS, type RoomName  } from "../../shared/constants.js";
import type { 
    ClientToServerEvents, 
    ServerToClientEvents, 
    SocketData 
} from "../../shared/types/socket.types.js";
import { getPrice } from "../../market/price-store.js";
import { insertTrade, getTradesByUserId } from "../services/trade.service.js";
import { decrementPending, getIsShuttingDown, incrementPending } from "../utils/shutdown.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerTradeHandlers(socket: AppSocket): void {
    socket.on(CLIENT_EVENTS.TRADE, async ({ token, side }) => {

        if(getIsShuttingDown()){
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "SERVER_SHUTTING_DOWN",
                message: "Server is shutting down, please reconnect shortly",
            });
            return;
        }
        // user is guaranteed by socketAuthMiddleware — but guard defensively
        // because TypeScript types socket.data.user as optional
        const user = socket.data.user;

        if (!VALID_ROOMS.has(token)) {
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "INVALID_ROOM",
                message: `Unknown token: ${token}`,
            });
            return;
        }

        const state = getPrice(token);
        if (!state) {
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "PRICE_UNAVAILABLE",
                message: `No price available for ${token}`,
            });
            return;
        }

        incrementPending(socket.id);

        try {
            const trade = await insertTrade({
                userId: user.id,
                token,
                side,
                price: state.price,
            });

            socket.emit(SERVER_EVENTS.TRADE_CONFIRM, trade);
        } catch (err) {
            console.error("trade:execute error", err);
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "TRADE_FAILED",
                message: "Failed to execute trade",
            });
        } finally {
            decrementPending(socket.id)
        }
    });

    socket.on(CLIENT_EVENTS.HISTORY, async () => {
        const user = socket.data.user;
        incrementPending(socket.id);
        try {
            const trades = await getTradesByUserId(user.id);
            socket.emit(SERVER_EVENTS.HISTORY_RESULT, { trades });
        } catch (err) {
            console.error("trade:history error", err);
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "HISTORY_FAILED",
                message: "Failed to fetch trade history",
            });
        } finally {
            decrementPending(socket.id)
        }
    });
}