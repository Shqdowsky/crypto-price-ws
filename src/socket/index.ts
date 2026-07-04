import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../shared/types/socket.types.js";
import type { Socket, Server } from "socket.io";
import { clearRateLimit } from "./middleware/rate-limit.middleware.js";
import { registerTradeHandlers } from "./handlers/trade.handler.js";
import { registerSocketHandlers } from "./handlers/socket.handlers.js";
import { cleanupSocket } from "./utils/shutdown.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function setupSocketServer(io: AppServer): void {
    io.on("connection", (socket: AppSocket) => {
        console.log(`Socket connected: ${socket.id} (user ${socket.data.user?.id})`);
        
        registerSocketHandlers(socket);
        registerTradeHandlers(socket);

        socket.on("disconnect", (reason) => {
            console.log(`Socket disconnected: ${socket.id} (${reason})`);
            clearRateLimit(socket.id);
            cleanupSocket(socket.id);
        });
    })
}