import type { NextFunction, Request, Response } from "express";
import type { PublicUser } from "@crypto-price-ws/shared";
import { findUserById } from "../../queries.js";

type AuthedRequest = Request & { user?: PublicUser };

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
	try {
		const current = req.user ? await findUserById(req.user.id) : null;
		if (!current) return res.status(401).json({ error: "Not authenticated" });
		if (current.role !== "admin") return res.status(403).json({ error: "Forbidden" });
		next();
	} catch (err) {
		console.error("requireAdmin failed", err);
		return res.status(500).json({ error: "Unexpected authorization error" });
	}
}
