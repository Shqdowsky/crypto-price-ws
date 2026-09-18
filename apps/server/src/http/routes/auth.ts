import { Router, type Request, type Response } from "express";
import { register, login } from "../service/auth.service.js";
import { AppError, isPgError, type ErrorResponse, type PgError } from "@crypto-price-ws/shared";
import type { PublicUser, ReqBody } from "@crypto-price-ws/shared";
import {validate} from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../../schemas/auth.schema.js";
import { setAccessCookie, clearAuthCookies, setRefreshCookie, issueTokens } from "../utils/authCookie.js";
import { requireAuth } from "../middleware/requireAuth.js";
import pool from "../../config/db.js";
import { generateRefreshToken, hashToken } from "../utils/refreshToken.js";
import { findUserById } from "../../queries.js";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const router = Router();

type TypedRequest<B = {}, P extends Record<string, string> = {}, Q = {}> 
  = Request<P, any, B, Q> & {
    user?: PublicUser;
  };

router.post("/register", validate(registerSchema), async (req: TypedRequest<ReqBody>, res: Response): Promise<void> => {
    try{
        const {username, email, password} = req.body;
        const user = await register(username, email, password);
        await issueTokens(res, user);
        res.status(201).json({message: "Registered successfully"});
    }catch(error){
        console.error(error)
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        if (isPgError(error) && error.code === "23505") {
            res.status(409).json({ message: "Email already registered" });
            return;
        }
        res.status(500).json({ message: "Unexpected registration error" });
    }
});
router.post("/login", validate(loginSchema), async(req: TypedRequest<Omit<ReqBody, 'username'>>, res: Response<PublicUser | Omit<ErrorResponse, 'code'>>): Promise<void> =>{
    try{
        const {email, password} = req.body;
        const user = await login(email, password);
        await issueTokens(res, user);
        res.json(user)
    }catch(error){
        console.error(error)
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return
        }
        res.status(500).json({ message: "Unexpected login error" });
    }
});

router.post("/auth/refresh", async (req, res) => {
    const incomingToken = req.cookies?.refresh_token;
    if (!incomingToken) return res.status(401).json({ error: "No refresh token" });
    const tokenHash = hashToken(incomingToken);

    const { rows } = await pool.query(
        `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash]
    );
    const record = rows[0];

    if (!record) {
        return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (record.revoked_at || new Date(record.expires_at) < new Date()) {
        await pool.query(
            `UPDATE refresh_tokens SET revoked_at = now()
            WHERE family_id = $1 AND revoked_at IS NULL`,
            [record.family_id]
        );
        return res.status(401).json({ error: "Refresh token reuse detected, session revoked" });
    }

    await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [record.id]);

    const user = await findUserById(record.user_id);
    if (!user) return res.status(401).json({ error: "User not found" });

    const newAccessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        env.JWT_SECRET as string,
        { expiresIn: "15m" }
    );
    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + Number(env.REFRESH_TOKEN_MAX_AGE));

    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
        VALUES ($1, $2, $3, $4)`,
        [user.id, hashToken(newRefreshToken), record.family_id, newExpiresAt]
    );

    setAccessCookie(res, newAccessToken);
    setRefreshCookie(res, newRefreshToken);

    res.json(user);

})

router.get("/me", requireAuth, async (req: TypedRequest, res) => {
    const result = await pool.query(`
        Select id, username, email
        From users
        Where id = $1
    `, [req.user?.id]);
    const user = result.rows[0] ?? null;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ user });
})

router.post("/logout", async (req, res) => {
    const incomingToken = req.cookies?.refresh_token;
    if (incomingToken) {
        await pool.query(
            `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`,
            [hashToken(incomingToken)]
        );
    }
    clearAuthCookies(res);
    res.status(200).json({ message: "Logged out" });
});

export default router;