import type { AccountState, RoomName, PositionRow, Position } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";
import { toPositionDTO } from "./trade.service.js";


export async function getAccountState(userId: number): Promise<AccountState>{
    const [userRes, posRes, closedRes] = await Promise.all([
        pool.query<{ balance: string }>(
            `SELECT balance FROM users WHERE id = $1`,
            [userId]
        ),
        pool.query<PositionRow>(
            `SELECT * FROM positions
             WHERE user_id = $1 and status = 'open'
             ORDER BY opened_at ASC`,
            [userId]
        ),
        pool.query<PositionRow>(
            `SELECT * FROM positions WHERE user_id = $1 AND status = 'closed' ORDER BY closed_at DESC`,
            [userId]
        ),
    ]);

    const user = userRes.rows[0];
    if (!user) throw new Error(`User ${userId} not found`);

    return {
        balance: user.balance,
        openPositions: posRes.rows.map(toPositionDTO),
        closedPositions: closedRes.rows.map(toPositionDTO),
    };
}