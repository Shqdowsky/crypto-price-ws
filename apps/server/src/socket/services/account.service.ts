import type { AccountState, RoomName, PositionRow, Position } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";


export async function getAccountState(userId: number): Promise<AccountState>{
    const [userRes, posRes] = await Promise.all([
        pool.query<{ balance: string }>(
            `SELECT balance FROM users WHERE id = $1`,
            [userId]
        ),
        pool.query<Position>(
            `SELECT * FROM positions
             WHERE user_id = $1 and status = 'open'
             ORDER BY opened_at ASC`,
            [userId]
        ),
    ]);

    const user = userRes.rows[0];
    if (!user) throw new Error(`User ${userId} not found`);

    return {
        balance: user.balance,
        openPositions: posRes.rows
    };
}