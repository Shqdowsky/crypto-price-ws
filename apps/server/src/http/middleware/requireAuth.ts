import type { PublicUser } from "@crypto-price-ws/shared";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

type TypedRequest<B = {}, P extends Record<string, string> = {}, Q = {}> = Request<P, any, B, Q> & {
  user?: PublicUser;
};

export function requireAuth(req: TypedRequest, res: Response, next: NextFunction){
    console.log("trying  to validate", req.cookies)
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    try {
        req.user = jwt.verify(token, env.JWT_SECRET as string) as PublicUser;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}