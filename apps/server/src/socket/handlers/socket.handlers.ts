import type { Socket } from "socket.io";
import { 
    CLIENT_EVENTS, 
    SERVER_EVENTS,
} from "@crypto-price-ws/shared";
import type { 
    ClientToServerEvents, 
    ServerToClientEvents, 
    SocketData, 
    TokenPayload
} from "@crypto-price-ws/shared";
import { getPrice } from "../../market/price-store.js";
import { checkRateLimit } from "../middleware/rate-limit.middleware.js";
import { isValidRoom } from "../utils/room-check.js";
import { addRoomSubscription, removeRoomSubscription } from "../services/room-subscription.service.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerSocketHandlers(socket: AppSocket): void {

    socket.on(CLIENT_EVENTS.SUBSCRIBE, async (room, callback) => {
        if (!isValidRoom(room)) {
            callback({
                success: false,
                error: { code: "INVALID_ROOM", message: `Unknown room: ${room}` },
            });
            return;
        }

        socket.join(room);
        try{
            await addRoomSubscription(socket.data.user.id, room);
        }catch(err){
            console.error("Failed to persist room subscription", err);
        }
        callback({ success: true });

        const state = getPrice(room);
        if (state) {
            socket.emit(SERVER_EVENTS.PRICE_CURRENT, {
                token: room,
                price: state.price,
                timestamp: state.updatedAt,
            });
        }
    });

    socket.on(CLIENT_EVENTS.UNSUBSCRIBE, async (room, callback) => {
        if (!isValidRoom(room)) {
            callback({
                success: false,
                error: { code: "INVALID_ROOM", message: `Unknown room: ${room}` },
            });
            return;
        }

        socket.leave(room);
         try {
            await removeRoomSubscription(socket.data.user.id, room);
        } catch (err) {
            console.error("Failed to remove room subscription", err);
        }
        callback({ success: true });
    });

    socket.on(CLIENT_EVENTS.GET_PRICE, (room, callback) => {
        const { allowed, retryAfterMs } = checkRateLimit(socket.id);
        if (!allowed) {
            socket.emit(SERVER_EVENTS.RATE_LIMITED, { retryAfterMs });
            callback({
                success: false,
                error: { code: "RATE_LIMITED", message: "Too many requests" },
            });
            return;
        }

        if (!isValidRoom(room)) {
            callback({
                success: false,
                error: { code: "INVALID_ROOM", message: `Unknown room: ${room}` },
            });
            return;
        }

        const state = getPrice(room);
        if (!state){
            callback({
                success: false,
                error: { code: "NO_PRICE_DATA", message: `No price data for: ${room}` },
            });
            return;
        };

        const payload: TokenPayload = {
            token: room,
            price: state.price,
            timestamp: state.updatedAt,
        };

        callback({ success: true, data: payload });
    });
}