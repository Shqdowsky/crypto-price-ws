import pool from "../../config/db.js";
import type { RoomName } from "../../shared/constants.js";
import type { TradeConfirm, TradeRow } from "../../shared/types/socket.types.js";

interface InsertTradeParams {
    userId: string;
    token: RoomName;
    side: "buy" | "sell";
    price: number;
}

export async function insertTrade(params: InsertTradeParams): Promise<TradeConfirm> {
    const { userId, token, side, price } = params;

    const result = await pool.query<TradeConfirm>(
        `INSERT INTO trades (user_id, token, side, price)
        VALUES ($1, $2, $3, $4)
        RETURNING id, token, side, price, created_at AS "createdAt"`,
        [userId, token, side, price]
    );

    const trade = result.rows[0];
    if (!trade) {
        throw new Error("Trade insert returned no rows");
    }

    return trade;
}

export async function getTradesByUserId(userId:string): Promise<TradeRow[]> {
    const result = await pool.query<TradeRow>(
        `SELECT id, token, side, price, created_at
        FROM trades
        WHERE user_id = $1
        ORDER BY created_at DESC`,
        [userId]
    );

    return result.rows;
}