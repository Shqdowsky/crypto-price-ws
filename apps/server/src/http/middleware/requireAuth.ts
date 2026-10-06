import type { PublicUser } from "@crypto-price-ws/shared";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

type TypedRequest<B = unknown, P extends Record<string, string> = Record<string, string>, Q = unknown> = Request<P, unknown, B, Q> & {
  user?: PublicUser;
};

export function requireAuth(req: TypedRequest, res: Response, next: NextFunction) {
  console.log("trying  to validate", req.cookies);
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    req.user = jwt.verify(token, env.JWT_SECRET as string) as PublicUser;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
