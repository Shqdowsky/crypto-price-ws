import type { AccountState, RoomName, PositionRow } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";


export async function getAccountState(userId: number): Promise<AccountState>{
    const [userRes, posRes] = await Promise.all([
        pool.query<{ balance: string }>(
            `SELECT balance FROM users WHERE id = $1`,
            [userId]
        ),
        pool.query<PositionRow>(
            `SELECT * FROM positions
             WHERE user_id = $1 AND status = 'open'
             ORDER BY opened_at ASC`,
            [userId]
        ),
    ]);

    const user = userRes.rows[0];
    if (!user) throw new Error(`User ${userId} not found`);

    return {
        balance: user.balance,
        openPositions: posRes.rows.map((p) => ({
            id: p.id,
            token: p.token as RoomName,
            quantity: p.quantity,
            avgCostBasis: p.avg_cost_basis,
            totalBought: p.total_bought,
            totalSold: p.total_sold,
            openedAt: p.opened_at,
        })),
    };
}