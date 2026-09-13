import type {Socket} from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { PublicUser } from "@crypto-price-ws/shared";
import pool from "../../config/db.js";
import * as cookie from 'cookie';
import { findUserById } from "../../queries.js";

export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return next(new Error("Not authenticated"));

    const parsed = cookie.parseCookie(cookieHeader);
    const token = parsed.token;

    if(!token){
        return next(new Error("Authentication token missing"));
    }

    try{
        const payload = jwt.verify(token, env.JWT_SECRET as string) as PublicUser;
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