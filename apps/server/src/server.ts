import httpserver from "./http/app.js";
import {Server} from "socket.io";
import { socketAuthMiddleware } from "./socket/middleware/auth.middleware.js";
import { setupSocketServer } from "./socket/index.js";
import { initTokenMap, startPriceLoop } from "./market/price-store.js";
import { SERVER_EVENTS } from "@crypto-price-ws/shared";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@crypto-price-ws/shared";
import { env } from "./config/env.js";
import { gracefulShutdown } from "./socket/utils/shutdown.js";
import pool from "./config/db.js";

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpserver, {
    cors: {
        origin: env.CLIENT_URL,
        credentials: true
    }
});

io.use(socketAuthMiddleware);

setupSocketServer(io);

initTokenMap();
startPriceLoop((room, state) => {
    io.to(room).emit(SERVER_EVENTS.PRICE_UPDATE, {
        token: room,
        price: state.price,
        timestamp: state.updatedAt
    })
})

httpserver.listen(env.WS_PORT, () => {
    console.log(`Server running on port ${env.WS_PORT}`);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM", io, httpserver, pool).catch(console.error));
process.on("SIGINT",  () => gracefulShutdown("SIGINT",  io, httpserver, pool).catch(console.error));