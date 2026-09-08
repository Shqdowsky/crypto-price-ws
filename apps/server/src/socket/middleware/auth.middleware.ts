import type {Socket} from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { AppJwtPayload, PublicUser } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";


async function findUserById(id: string): Promise<PublicUser | null >{
    const result = await pool.query(`
        Select id, username, email
        From users
        Where id = $1
    `, [id]);
    return result.rows[0] ?? null
}

export async  function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const token = 
        socket.handshake.auth?.token ??
        socket.handshake.query?.token;
    if(!token){
        return next(new Error("Authentication token missing"));
    }

    try{
        const payload = jwt.verify(token, env.JWT_SECRET as string) as AppJwtPayload;
        const user = await findUserById(payload.id);
        if (!user) {
            return next(new Error("User not found"));
        }
        socket.data.user = payload;
        next()
    }catch{
        next(new Error("Invalid or expired token"));
    }
}