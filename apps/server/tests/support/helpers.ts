import pool from "../../src/config/db.js";
import { randomUUID } from "node:crypto";

export async function createTestUser(
  balance = "1000.00",
  username = `test_${randomUUID()}`,
): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO users (username, email, password, balance) VALUES ($1, $2, $3, $4) RETURNING id`,
    [username, `${username}@example.com`, "unused-in-tests", balance],
  );
  return result.rows[0]!.id;
}

export async function setUserRole(userId: number, role: "user" | "admin"): Promise<void> {
  await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
}

export async function addRoomSubscription(userId: number, room: string): Promise<void> {
  await pool.query(`INSERT INTO user_room_subscriptions (user_id, room) VALUES ($1, $2)`, [
    userId,
    room,
  ]);
}

export async function deleteTestUsers(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;
  await pool.query(`DELETE FROM user_room_subscriptions WHERE user_id = ANY($1::int[])`, [userIds]);
  await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [userIds]);
}