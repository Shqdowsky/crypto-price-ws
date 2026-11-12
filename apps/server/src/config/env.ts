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

const databaseUrl = process.env.NODE_ENV === "test" ? undefined : process.env.DATABASE_URL;

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
	WS_PORT: Number(process.env.PORT ?? requireEnv("WS_PORT")),
	CLIENT_URL: requireEnv("CLIENT_URL") as string,
	REFRESH_TOKEN_MAX_AGE: requireEnv("REFRESH_TOKEN_MAX_AGE"),
	ACCESS_TOKEN_MAX_AGE: requireEnv("ACCESS_TOKEN_MAX_AGE"),
	WS_URL: requireEnv("WS_URL"),
	PRICE_SOURCE: requireEnv("PRICE_SOURCE"),
	REDIS_URL: process.env.REDIS_URL || undefined,
};
