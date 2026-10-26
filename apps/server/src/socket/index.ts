import {
  ROOMS,
  SERVER_EVENTS,
  type ClientToServerEvents,
  type RoomName,
  type ServerToClientEvents,
  type SocketData,
} from "@crypto-price-ws/shared";
import type { Socket, Server } from "socket.io";
import { rateLimitPacketMiddleware } from "./middleware/rate-limit.middleware.js";
import { registerTradeHandlers } from "./handlers/trade.handler.js";
import { registerSocketHandlers } from "./handlers/socket.handlers.js";
import { cleanupSocket } from "./utils/shutdown.js";
import { getAccountState } from "./services/account.service.js";
import { initNotifier, userRoom } from "./notifier.js";
import { getPrice } from "../market/price-store.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

const ALL_ROOMS: RoomName[] = Object.values(ROOMS);

export function setupSocketServer(io: AppServer): void {
  initNotifier(io);
  io.on("connection", async (socket: AppSocket) => {
    socket.join(userRoom(socket.data.user.id));
    socket.use(rateLimitPacketMiddleware(socket));
    console.log(`Socket connected: ${socket.id} (user ${socket.data.user?.id})`);

    registerSocketHandlers(socket);
    registerTradeHandlers(socket);

    for (const room of ALL_ROOMS) {
      socket.join(room);
      const current = getPrice(room);
      if (current) {
        socket.emit(SERVER_EVENTS.PRICE_CURRENT, {
          token: room,
          price: current.price,
          timestamp: current.updatedAt,
        });
      }
    }

    getAccountState(socket.data.user.id)
      .then((state) => socket.emit(SERVER_EVENTS.ACCOUNT_STATE, state))
      .catch((err) => console.error("account:state push failed", err));

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
      cleanupSocket(socket.id);
    });
  });
}
