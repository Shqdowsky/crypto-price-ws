import pool from "../../src/config/db.js";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";

export async function createTestUser(
	balance = "1000.00",
	username = `test_${randomUUID()}`,
	password?: string,
): Promise<number> {
	const passwordHash = password ? await bcrypt.hash(password, 4) : "unused-in-tests";
	const result = await pool.query<{ id: number }>(
		`INSERT INTO users (username, email, password, balance) VALUES ($1, $2, $3, $4) RETURNING id`,
		[username, `${username}@example.com`, passwordHash, balance],
	);
	return result.rows[0]!.id;
}

export async function setUserRole(userId: number, role: "user" | "admin"): Promise<void> {
	await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
}

export async function deleteTestUsers(userIds: number[]): Promise<void> {
	if (userIds.length === 0) return;
	await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [userIds]);
}
