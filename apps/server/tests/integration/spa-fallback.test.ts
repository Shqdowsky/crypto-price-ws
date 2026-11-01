import { existsSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../../src/http/app.js";
import pool from "../../src/config/db.js";

// Only present after `npm run build --workspace=apps/client` (CI does not build the client).
const built = existsSync(path.join(import.meta.dirname, "../../../client/dist/index.html"));

afterAll(async () => {
	await pool.end();
});

describe("SPA fallback", () => {
	it("leaves API calls (Accept: json) to the routers, even on URLs shared with client routes", async () => {
		const res = await request(app).get("/admin/users/1").set("Accept", "application/json");
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.type).toBe("application/json");
	});

	it("leaves requests without an Accept header to the routers", async () => {
		const res = await request(app).get("/admin/users/1");
		expect(res.type).not.toBe("text/html");
	});

	it("does not answer POST with the page", async () => {
		// Express's own "Cannot POST" page is html too, so assert on the status, not the type.
		const res = await request(app).post("/login").set("Accept", "text/html");
		expect(res.status).toBe(404);
	});

	it.skipIf(!built)("serves index.html for a client-only route on browser navigation", async () => {
		const res = await request(app).get("/login").set("Accept", "text/html");
		expect(res.status).toBe(200);
		expect(res.type).toBe("text/html");
	});

	it.skipIf(!built)(
		"serves index.html on reload of a client route that is also an API URL",
		async () => {
			const res = await request(app).get("/admin/users/1").set("Accept", "text/html");
			expect(res.status).toBe(200);
			expect(res.type).toBe("text/html");
		},
	);

	it.skipIf(built)("falls through to a 404 when the client is not built", async () => {
		const res = await request(app).get("/login").set("Accept", "text/html");
		expect(res.status).toBe(404);
	});
});
