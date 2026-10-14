import type {
    AdminUserDetail,
    AdminUsersPage,
    AdminUserSummary,
    PositionRow,
    RoomName,
    TradeHistoryEntry,
    UserRole,
} from "@crypto-price-ws/shared";
import pool from "../../config/db.js";
import { toPositionDTO } from "../../socket/services/trade.service.js";

const TRADES_LIMIT = 500;

interface UserSummaryRow {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    balance: string;
    created_at: Date | string;
    open_positions_count: number;
}

const SUMMARY_SELECT = `
    SELECT u.id, u.username, u.email, u.role, u.balance, u.created_at,
         (SELECT COUNT(*)::int FROM positions p
           WHERE p.user_id = u.id AND p.status = 'open') AS open_positions_count
    FROM users u
`;

function toSummary(row: UserSummaryRow): AdminUserSummary {
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        balance: row.balance,
        createdAt: new Date(row.created_at).toISOString(),
        openPositionsCount: row.open_positions_count,
    };
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

export async function listUsers(params: {
    search: string | undefined;
    page: number;
    pageSize: number;
}): Promise<AdminUsersPage> {
    const { search, page, pageSize } = params;
    const pattern = search ? `%${escapeLike(search)}%` : null;
    const where = `WHERE ($1::text IS NULL OR u.username ILIKE $1 OR u.email ILIKE $1)`;

    const [rows, count] = await Promise.all([
        pool.query<UserSummaryRow>(
            `${SUMMARY_SELECT} ${where} ORDER BY u.created_at DESC, u.id DESC LIMIT $2 OFFSET $3`,
            [pattern, pageSize, (page - 1) * pageSize],
        ),
        pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM users u ${where}`, [
            pattern,
        ]),
    ]);

    return {
        users: rows.rows.map(toSummary),
        total: count.rows[0]?.count ?? 0,
        page,
        pageSize,
    };
}

export async function getUserDetail(userId: number): Promise<AdminUserDetail | null> {
    const [summary, open, closed] = await Promise.all([
        pool.query<UserSummaryRow>(`${SUMMARY_SELECT} WHERE u.id = $1`, [userId]),
        pool.query<PositionRow>(
            `SELECT * FROM positions WHERE user_id = $1 AND status = 'open' ORDER BY opened_at ASC`,
            [userId],
        ),
        pool.query<PositionRow>(
            `SELECT * FROM positions WHERE user_id = $1 AND status = 'closed' ORDER BY closed_at DESC`,
            [userId],
        ),
    ]);

    const row = summary.rows[0];
    if (!row) return null;

    return {
        user: toSummary(row),
        openPositions: open.rows.map(toPositionDTO),
        closedPositions: closed.rows.map(toPositionDTO),
    };
}

export async function userExists(userId: number): Promise<boolean> {
    const result = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [userId]);
    return result.rows.length > 0;
}

export async function getUserTrades(
    userId: number,
    token?: RoomName,
): Promise<TradeHistoryEntry[]> {
    const result = await pool.query<{
        id: number;
        token: string;
        side: "buy" | "sell";
        price: string;
        quantity: string;
        created_at: Date | string;
    }>(
        `SELECT id, token, side, price, quantity, created_at
        FROM trades
        WHERE user_id = $1 AND ($2::text IS NULL OR token = $2)
        ORDER BY created_at DESC, id DESC
        LIMIT ${TRADES_LIMIT}`,
        [userId, token ?? null],
    );

    return result.rows.map((r) => ({
        id: r.id,
        token: r.token as RoomName,
        side: r.side,
        price: r.price,
        quantity: r.quantity,
        createdAt: new Date(r.created_at).toISOString(),
    }));
}