import type { Socket } from "socket.io";
import { CLIENT_EVENTS } from "@crypto-price-ws/shared";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	SocketData,
	TokenPayload,
} from "@crypto-price-ws/shared";
import { getPrice } from "../../market/price-store.js";
import { isValidRoom } from "../utils/room-check.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerSocketHandlers(socket: AppSocket): void {
	socket.on(CLIENT_EVENTS.GET_PRICE, (room, callback) => {
		if (!isValidRoom(room)) {
			callback({
				success: false,
				error: { code: "INVALID_ROOM", message: `Unknown room: ${room}` },
			});
			return;
		}

		const state = getPrice(room);
		if (!state) {
			callback({
				success: false,
				error: { code: "NO_PRICE_DATA", message: `No price data for: ${room}` },
			});
			return;
		}

		const payload: TokenPayload = {
			token: room,
			price: state.price,
			PDChange: state.PDChange,
			timestamp: state.updatedAt,
		};

		callback({ success: true, data: payload });
	});
}
