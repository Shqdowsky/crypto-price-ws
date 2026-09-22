import type { RoomName } from "@system-monitor/shared";
import pool from "../../config/db.js";

export async function addRoomSubscription(userId: number, room: RoomName): Promise<void> {
    await pool.query(
        `INSERT INTO user_room_subscriptions (user_id, room)
         VALUES ($1, $2)
         ON CONFLICT (user_id, room) DO NOTHING`,
        [userId, room]
    );
}

export async function removeRoomSubscription(userId: number, room: RoomName): Promise<void> {
    await pool.query(
        `DELETE FROM user_room_subscriptions WHERE user_id = $1 AND room = $2`,
        [userId, room]
    );
}

export async function getRoomSubscriptions(userId: number): Promise<string[]> {
    const result = await pool.query<{ room: string }>(
        `SELECT room FROM user_room_subscriptions WHERE user_id = $1`,
        [userId]
    );
    return result.rows.map((row) => row.room);
}