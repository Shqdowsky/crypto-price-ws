import type { Socket } from "socket.io";
import { CLIENT_EVENTS, SERVER_EVENTS, VALID_ROOMS, type RoomName  } from "@crypto-price-ws/shared";
import type { 
    ClientToServerEvents, 
    ServerToClientEvents, 
    SocketData, 
    TradeRow
} from "@crypto-price-ws/shared";
import { getPrice } from "../../market/price-store.js";
import { insertTrade, getTradesByUserId } from "../services/trade.service.js";
import { decrementPending, getIsShuttingDown, incrementPending } from "../utils/shutdown.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerTradeHandlers(socket: AppSocket): void {
    socket.on(CLIENT_EVENTS.TRADE, async ({ token, side }, callback) => {

        if(getIsShuttingDown()){
            callback({
                success: false,
                error: {
                    code: "SERVER_SHUTTING_DOWN",
                    message: "Server is shutting down, please reconnect shortly",
                }
            })
            return;
        }

        const user = socket.data.user;

        if (!VALID_ROOMS.has(token)) {
            callback({
                success: false,
                error: { code: "INVALID_ROOM", message: `Unknown token: ${token}` },
            });
            return;
        }

        const state = getPrice(token);
        if (!state) {
            callback({
                success: false,
                error: { code: "PRICE_UNAVAILABLE", message: `No price available for ${token}` },
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

            callback({ success: true, data: trade });
            socket.emit(SERVER_EVENTS.TRADE_CONFIRM, trade);
        } catch (err) {
            console.error("trade:execute error", err);
            callback({
                success: false,
                error: { code: "TRADE_FAILED", message: "Failed to execute trade" },
            });
        } finally {
            decrementPending(socket.id)
        }
    });

    socket.on(CLIENT_EVENTS.HISTORY, async (callback) => {
        const user = socket.data.user;
        incrementPending(socket.id);
        try {
            const trades: TradeRow[] = await getTradesByUserId(user.id);
             callback({ success: true, data: { trades } });
        } catch (err) {
            console.error("trade:history error", err);
            callback({
                success: false,
                error: { code: "HISTORY_FAILED", message: "Failed to fetch trade history" },
            });
        } finally {
            decrementPending(socket.id)
        }
    });
}