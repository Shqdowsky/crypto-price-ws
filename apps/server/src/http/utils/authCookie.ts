import type {   Response, CookieOptions  } from "express";
import { generateRefreshToken, hashToken } from "./refreshToken.js";
import pool from "../../config/db.js";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { PublicUser } from "@system-monitor/shared";

const isProd = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_MAX_AGE = Number(env.ACCESS_TOKEN_MAX_AGE) * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = Number(env.REFRESH_TOKEN_MAX_AGE) * 24 * 60 * 60 * 1000;

const COOKIE_OPTIONS: CookieOptions  = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax", 
}

function setAccessCookie(res: Response, token: string ) {
  res.cookie("token", token, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/"
  });
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refresh_token", token, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/auth/refresh",
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie("token", { ...COOKIE_OPTIONS, path: "/" });
  res.clearCookie("refresh_token", { ...COOKIE_OPTIONS, path: "/auth/refresh" });
}

async function issueTokens(res: Response, user: PublicUser) {
  const accessToken = jwt.sign(
    user,
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" }
  );

  const refreshToken = generateRefreshToken();
  const familyId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, hashToken(refreshToken), familyId, expiresAt]
  );

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
}

export { setAccessCookie, setRefreshCookie, clearAuthCookies, issueTokens, COOKIE_OPTIONS };