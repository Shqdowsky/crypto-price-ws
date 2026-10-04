import pool from "../config/db.js";
import { randomUUID } from "node:crypto";

export async function createTestUser(balance = "1000.00"): Promise<number> {
    const suffix = randomUUID();
    const result = await pool.query<{ id: number }>(
        `INSERT INTO users (username, email, password, balance)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`test_${suffix}`, `test_${suffix}@example.com`, "unused-in-tests", balance]
    );
    return result.rows[0]!.id;
}

export async function deleteTestUsers(userIds: number[]): Promise<void> {
    if (userIds.length === 0) return;
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [userIds]);
}