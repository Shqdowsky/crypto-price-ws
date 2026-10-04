import { describe, it, expect, afterEach, afterAll } from "vitest";
import { executeTrade } from "./trade.service.js";
import { createTestUser, deleteTestUsers } from "../../test/helpers.js";
import { TradeError } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";

const TOKEN = "btc";
let createdUserIds: number[] = [];

async function newUser(balance = "1000.00"): Promise<number> {
    const id = await createTestUser(balance);
    createdUserIds.push(id);
    return id;
}

afterEach(async () => {
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
});

afterAll(async () => {
    await pool.end();
});

describe("executeTrade", () => {
    it("first buy creates an open position and debits balance", async () => {
        const userId = await newUser("1000.00");

        const result = await executeTrade({ userId, token: TOKEN, side: "buy", qty: 1, price: 100 });

        expect(result.position.status).toBe("open");
        expect(result.position.quantity).toBe("1.00000000");
        expect(result.position.avg_cost_basis).toBe("100.00000000");
        expect(result.position.total_bought).toBe("1.00000000");
        expect(result.balance).toBe("900.00");
    });

    it("second buy rolls into a weighted-average cost basis exactly", async () => {
        const userId = await newUser("1000.00");

        await executeTrade({ userId, token: TOKEN, side: "buy", qty: 10, price: 5 });
        const result = await executeTrade({ userId, token: TOKEN, side: "buy", qty: 10, price: 7 });

        expect(result.position.quantity).toBe("20.00000000");
        expect(result.position.avg_cost_basis).toBe("6.00000000");
        expect(result.position.total_bought).toBe("20.00000000");
    });

    it("partial sell reduces quantity, keeps position open, leaves avg_cost_basis untouched", async () => {
        const userId = await newUser("1000.00");

        await executeTrade({ userId, token: TOKEN, side: "buy", qty: 10, price: 5 });
        const result = await executeTrade({ userId, token: TOKEN, side: "sell", qty: 4, price: 6 });

        expect(result.position.status).toBe("open");
        expect(result.position.quantity).toBe("6.00000000");
        expect(result.position.avg_cost_basis).toBe("5.00000000"); // unchanged by a sell
        expect(result.position.total_sold).toBe("4.00000000");
        expect(result.position.running_sell_total).toBe("24.00000000");
    });

    it("a sell that exactly zeroes quantity closes the position with final stats", async () => {
        const userId = await newUser("1000.00");

        await executeTrade({ userId, token: TOKEN, side: "buy", qty: 10, price: 5 });
        const result = await executeTrade({ userId, token: TOKEN, side: "sell", qty: 10, price: 6 });

        expect(result.position.status).toBe("closed");
        expect(result.position.closed_at).not.toBeNull();
        expect(result.position.quantity).toBe("0.00000000");
        expect(result.position.avg_sell_price).toBe("6.00000000");
        expect(result.position.realized_pnl).toBe("10.00"); // (6-5)*10
    });

    it("rejects a sell that exceeds the currently open position", async () => {
        const userId = await newUser("1000.00");
        await executeTrade({ userId, token: TOKEN, side: "buy", qty: 5, price: 100 });

        await expect(
            executeTrade({ userId, token: TOKEN, side: "sell", qty: 10, price: 100 })
        ).rejects.toMatchObject({ code: "SELL_EXCEEDS_POSITION" });
    });

    it("rejects a sell when there is no open position at all", async () => {
        const userId = await newUser("1000.00");

        await expect(
            executeTrade({ userId, token: TOKEN, side: "sell", qty: 1, price: 100 })
        ).rejects.toMatchObject({ code: "NO_OPEN_POSITION" });
    });

    it("rejects a buy that costs more than the available balance", async () => {
        const userId = await newUser("100.00");

        await expect(
            executeTrade({ userId, token: TOKEN, side: "buy", qty: 10, price: 100 })
        ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });

    it("buying again after a position closes opens a brand-new position row", async () => {
        const userId = await newUser("1000.00");

        const first = await executeTrade({ userId, token: TOKEN, side: "buy", qty: 10, price: 5 });
        await executeTrade({ userId, token: TOKEN, side: "sell", qty: 10, price: 6 }); // closes it

        const second = await executeTrade({ userId, token: TOKEN, side: "buy", qty: 2, price: 8 });

        expect(second.position.status).toBe("open");
        expect(second.position.id).not.toBe(first.position.id);
        expect(second.position.quantity).toBe("2.00000000");
        expect(second.position.avg_cost_basis).toBe("8.00000000"); // fresh average, no bleed from the closed row
    });

    it("two concurrent first buys for a brand-new user+token never create duplicate open positions", async () => {
        const userId = await newUser("1000.00");

        const [r1, r2] = await Promise.all([
            executeTrade({ userId, token: TOKEN, side: "buy", qty: 1, price: 100 }),
            executeTrade({ userId, token: TOKEN, side: "buy", qty: 1, price: 100 }),
        ]);

        expect(r1.position.id).toBe(r2.position.id);

        const finalQuantity = r1.position.quantity === "2.00000000" || r2.position.quantity === "2.00000000";
        expect(finalQuantity).toBe(true);
    });
});