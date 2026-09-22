import { SERVER_EVENTS, type ClientToServerEvents, type RoomName, type ServerToClientEvents, type SocketData } from "@crypto-price-ws/shared";
import type { Socket, Server } from "socket.io";
import { clearRateLimit } from "./middleware/rate-limit.middleware.js";
import { registerTradeHandlers } from "./handlers/trade.handler.js";
import { registerSocketHandlers } from "./handlers/socket.handlers.js";
import { cleanupSocket } from "./utils/shutdown.js";
import { getRoomSubscriptions } from "./services/room-subscription.service.js";
import { isValidRoom } from "./utils/room-check.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function setupSocketServer(io: AppServer): void {
    io.on("connection", async (socket: AppSocket) => {
        console.log(`Socket connected: ${socket.id} (user ${socket.data.user?.id})`);
        const rooms = await getRoomSubscriptions(socket.data.user.id);
        const validRooms = rooms.filter(isValidRoom) as RoomName[];

        for (const room of validRooms) {
            socket.join(room);
        }
        socket.emit(SERVER_EVENTS.ROOMS_RESTORED, { rooms: validRooms });
        registerSocketHandlers(socket);
        registerTradeHandlers(socket);
        

        socket.on("disconnect", (reason) => {
            console.log(`Socket disconnected: ${socket.id} (${reason})`);
            clearRateLimit(socket.id);
            cleanupSocket(socket.id);
        });
    })
}