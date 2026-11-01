import dotenv from "dotenv";
import type { PoolConfig } from "pg";
if (process.env.NODE_ENV !== "test") {
	dotenv.config();
}

function requireEnv(key: string): string | number {
	const value = process.env[key];
	if (!value) throw new Error(`Missing required env variable: ${key}`);
	return value;
}

// Never read DATABASE_URL under test: a stray variable on a dev machine must not point the
// suite (which creates and deletes users) at a real database.
const databaseUrl = process.env.NODE_ENV === "test" ? undefined : process.env.DATABASE_URL;

// One pool config for the app and the migrate script. Heroku Postgres provides only
// DATABASE_URL and requires TLS with a certificate Node cannot verify, hence
// rejectUnauthorized: false (the connection is still encrypted).
// max is configurable: Heroku's smaller Postgres plans allow ~20 connections in total.
export const dbConfig: PoolConfig = databaseUrl
	? {
			connectionString: databaseUrl,
			...(process.env.NODE_ENV === "production" && { ssl: { rejectUnauthorized: false } }),
			max: Number(process.env.DB_POOL_MAX ?? 50),
		}
	: {
			host: requireEnv("DB_HOST") as string,
			port: Number(requireEnv("DB_PORT")),
			database: requireEnv("DB_NAME") as string,
			user: requireEnv("DB_USER") as string,
			password: requireEnv("DB_PASSWORD") as string,
			max: Number(process.env.DB_POOL_MAX ?? 50),
		};

export const env = {
	JWT_SECRET: requireEnv("JWT_SECRET"),
	// Heroku assigns the port through PORT; locally WS_PORT is used.
	WS_PORT: Number(process.env.PORT ?? requireEnv("WS_PORT")),
	CLIENT_URL: requireEnv("CLIENT_URL") as string,
	REFRESH_TOKEN_MAX_AGE: requireEnv("REFRESH_TOKEN_MAX_AGE"),
	ACCESS_TOKEN_MAX_AGE: requireEnv("ACCESS_TOKEN_MAX_AGE"),
	WS_URL: requireEnv("WS_URL"),
	PRICE_SOURCE: requireEnv("PRICE_SOURCE"),
};
