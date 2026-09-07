import type { Socket } from "socket.io";
import { 
    CLIENT_EVENTS, 
    SERVER_EVENTS,
} from "../../shared/constants.js";
import type { 
    ClientToServerEvents, 
    ServerToClientEvents, 
    SocketData 
} from "../../shared/types/socket.types.js";
import { getPrice } from "../../market/price-store.js";
import { checkRateLimit } from "../middleware/rate-limit.middleware.js";
import { isValidRoom } from "../utils/room-check.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerSocketHandlers(socket: AppSocket): void {

    socket.on(CLIENT_EVENTS.SUBSCRIBE, (room) => {
        if (!isValidRoom(room)) {
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "INVALID_ROOM",
                message: `Unknown room: ${room}`,
            });
            return;
        }

        socket.join(room);

        const state = getPrice(room);
        if (state) {
            socket.emit(SERVER_EVENTS.PRICE_CURRENT, {
                token: room,
                price: state.price,
                timestamp: state.updatedAt,
            });
        }
    });

    socket.on(CLIENT_EVENTS.UNSUBSCRIBE, (room) => {
        if (!isValidRoom(room)) return;
        socket.leave(room);
    });

    socket.on(CLIENT_EVENTS.GET_PRICE, (room) => {
        const { allowed, retryAfterMs } = checkRateLimit(socket.id);
        if (!allowed) {
            socket.emit(SERVER_EVENTS.RATE_LIMITED, { retryAfterMs });
            return;
        }

        if (!isValidRoom(room)) {
            socket.emit(SERVER_EVENTS.ERROR, {
                code: "INVALID_ROOM",
                message: `Unknown room: ${room}`,
            });
            return;
        }

        const state = getPrice(room);
        if (!state) return;

        socket.emit(SERVER_EVENTS.PRICE_CURRENT, {
            token: room,
            price: state.price,
            timestamp: state.updatedAt,
        });
    });
}