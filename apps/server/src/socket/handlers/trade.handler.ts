import type { Socket } from "socket.io";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  TradeError,
  VALID_ROOMS,
  type RoomName,
} from "@crypto-price-ws/shared";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@crypto-price-ws/shared";
import { getPrice } from "../../market/price-store.js";
import {
  executeTrade,
  getPositionHistory,
  getTokenTradeHistory,
  toPositionDTO,
} from "../services/trade.service.js";
import { decrementPending, getIsShuttingDown, incrementPending } from "../utils/shutdown.js";
import { getAccountState } from "../services/account.service.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerTradeHandlers(socket: AppSocket): void {
  socket.on(CLIENT_EVENTS.TRADE, async ({ token, side, quantity }, callback) => {
    if (getIsShuttingDown()) {
      callback({
        success: false,
        error: {
          code: "SERVER_SHUTTING_DOWN",
          message: "Server is shutting down, please reconnect shortly",
        },
      });
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

    if (side !== "buy" && side !== "sell") {
      callback({
        success: false,
        error: { code: "INVALID_SIDE", message: `Invalid side: ${side}` },
      });
      return;
    }

    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
      callback({
        success: false,
        error: { code: "INVALID_QUANTITY", message: "Quantity must be a positive number" },
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
      const { position, trade, balance } = await executeTrade({
        userId: user.id,
        token,
        side,
        price: state.price,
        qty: quantity,
      });

      const tradeConfirm = {
        id: trade.id,
        token: trade.token as RoomName,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        createdAt: trade.created_at,
        position: toPositionDTO(position),
      };

      callback({ success: true, data: tradeConfirm });
      socket.emit(SERVER_EVENTS.BALANCE_UPDATED, { balance });
    } catch (err) {
      console.error("trade:execute error", err);
      if (err instanceof TradeError) {
        callback({
          success: false,
          error: { code: err.code, message: err.message },
        });
        return;
      }

      callback({
        success: false,
        error: { code: "TRADE_FAILED", message: "Failed to execute trade" },
      });
    } finally {
      decrementPending(socket.id);
    }
  });

  socket.on(CLIENT_EVENTS.GET_TRADE_HISTORY, async ({ token }, callback) => {
    if (!VALID_ROOMS.has(token)) {
      callback({
        success: false,
        error: { code: "INVALID_ROOM", message: `Unknown token: ${token}` },
      });
      return;
    }
    incrementPending(socket.id);
    try {
      const trades = await getTokenTradeHistory(socket.data.user.id, token);
      callback({ success: true, data: { token, trades } });
    } catch (err) {
      console.error("trade:history:token error", err);
      callback({
        success: false,
        error: { code: "TRADE_HISTORY_FAILED", message: "Failed to fetch trade history" },
      });
    } finally {
      decrementPending(socket.id);
    }
  });

  socket.on(CLIENT_EVENTS.GET_ACCOUNT_STATE, async (callback) => {
    const user = socket.data.user;
    incrementPending(socket.id);
    try {
      const state = await getAccountState(user.id);
      callback({ success: true, data: state });
    } catch (err) {
      console.error("account:get error", err);
      callback({
        success: false,
        error: { code: "ACCOUNT_STATE_FAILED", message: "Failed to fetch account state" },
      });
    } finally {
      decrementPending(socket.id);
    }
  });

  socket.on(CLIENT_EVENTS.GET_POSITION_HISTORY, async ({ token }, callback) => {
    if (!VALID_ROOMS.has(token)) {
      callback({
        success: false,
        error: { code: "INVALID_ROOM", message: `Unknown token: ${token}` },
      });
      return;
    }
    incrementPending(socket.id);
    try {
      const positions = await getPositionHistory(socket.data.user.id, token);
      callback({ success: true, data: { token, positions } });
    } catch (err) {
      console.error("position:history error", err);
      callback({
        success: false,
        error: { code: "POSITION_HISTORY_FAILED", message: "Failed to fetch position history" },
      });
    } finally {
      decrementPending(socket.id);
    }
  });
}
