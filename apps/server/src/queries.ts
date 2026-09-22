import type { PublicUser } from "@system-monitor/shared";
import pool from "./config/db.js";

export async function findUserById(id: number): Promise<PublicUser | null >{
    const result = await pool.query(`
        Select id, username, email
        From users
        Where id = $1
    `, [id]);
    return result.rows[0] ?? null
}