import { describe, it, expect } from "vitest";
import { socketReducer, initialSocketState } from "./socketReducer";

describe("socketReducer", () => {
    it("adds a price point and caps history at 60 entries", () => {
        let state = initialSocketState;
        for(let i = 0; i < 65; i++){
            state = socketReducer(state, {
                type: "PRICE_UPDATE",
                payload: { token: "btc", price: 100 + i, timestamp: i },
            });
        }
        expect(state.priceHistory.btc).toHaveLength(60);
        expect(state.priceHistory.btc?.[0].price).toBe(105); 
    });

    it("marks a room joined", () => {
        const state = socketReducer(initialSocketState, { type: "ROOM_JOINED", room: "btc" });
        expect(state.joinedRooms.has("btc")).toBe(true);
    });

    it("stores a server error", () => {
        const error = { code: "INVALID_ROOM", message: "bad room" };
        const state = socketReducer(initialSocketState, { type: "SERVER_ERROR", payload: error });
        expect(state.lastError).toEqual(error);
    });
})