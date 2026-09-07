import pool from "../config/db.js";
import type { PublicUser } from "./types/user.type.js";

export async function findUserById(id: string): Promise<PublicUser | null >{
    const result = await pool.query(`
        Select id, username, email
        From users
        Where id = $1
    `, [id]);
    return result.rows[0] ?? null
}