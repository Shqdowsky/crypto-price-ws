import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// env.ts reads process.env once at import, so every case re-imports a fresh copy.
async function loadEnv() {
	vi.resetModules();
	return import("../../src/config/env.js");
}

beforeEach(() => {
	vi.stubEnv("DB_POOL_MAX", undefined);
	vi.stubEnv("PORT", undefined);
	vi.stubEnv("DATABASE_URL", undefined);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("env: port", () => {
	it("uses WS_PORT when PORT is not set", async () => {
		vi.stubEnv("WS_PORT", "8080");
		expect((await loadEnv()).env.WS_PORT).toBe(8080);
	});

	it("lets Heroku's PORT win over WS_PORT", async () => {
		vi.stubEnv("WS_PORT", "8080");
		vi.stubEnv("PORT", "34567");
		expect((await loadEnv()).env.WS_PORT).toBe(34567);
	});
});

describe("env: dbConfig", () => {
	it("ignores DATABASE_URL under test so the suite cannot hit a real database", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://u:p@prod.example.com/db");
		const { dbConfig } = await loadEnv();
		expect(dbConfig.connectionString).toBeUndefined();
		expect(dbConfig.host).toBe(process.env.DB_HOST);
		expect(typeof dbConfig.port).toBe("number");
	});

	it("uses DATABASE_URL with TLS in production and does not need DB_* then", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("DATABASE_URL", "postgres://u:p@prod.example.com/db");
		vi.stubEnv("DB_HOST", undefined);
		const { dbConfig } = await loadEnv();
		expect(dbConfig.connectionString).toBe("postgres://u:p@prod.example.com/db");
		expect(dbConfig.ssl).toEqual({ rejectUnauthorized: false });
		expect(dbConfig.host).toBeUndefined();
	});

	it("takes the pool size from DB_POOL_MAX, default 50", async () => {
		expect((await loadEnv()).dbConfig.max).toBe(50);
		vi.stubEnv("DB_POOL_MAX", "15");
		expect((await loadEnv()).dbConfig.max).toBe(15);
	});
});
