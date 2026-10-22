import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/http/app.js";
import pool from "../../src/config/db.js";
import { resetLoginThrottle } from "../../src/http/service/login-throttle.js";
import { createTestUser, deleteTestUsers } from "../support/helpers.js";

const PASSWORD = "Passw0rd!123";
const WRONG_PASSWORD = "Wrong-Passw0rd!9";

let createdUserIds: number[] = [];

async function newLoginUser(): Promise<string> {
  const username = `login_${randomUUID()}`;
  createdUserIds.push(await createTestUser("1000.00", username, PASSWORD));
  return `${username}@example.com`;
}

const login = (email: string, password: string) =>
  request(app).post("/auth/login").send({ email, password });

beforeEach(() => {
  resetLoginThrottle();
});

afterEach(async () => {
  await deleteTestUsers(createdUserIds);
  createdUserIds = [];
});

afterAll(async () => {
  await pool.end();
});

describe("POST /auth/login throttle", () => {
  it("counts down attempts left, then locks on the 5th wrong password", async () => {
    const email = await newLoginUser();

    for (const expectedLeft of [4, 3, 2, 1]) {
      const res = await login(email, WRONG_PASSWORD);
      expect(res.status).toBe(401);
      expect(res.body.attemptsLeft).toBe(expectedLeft);
    }

    const locked = await login(email, WRONG_PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.headers["retry-after"]).toBeDefined();
  });

  it("refuses even the correct password while locked", async () => {
    const email = await newLoginUser();
    for (let i = 0; i < 5; i++) await login(email, WRONG_PASSWORD);

    const res = await login(email, PASSWORD);

    expect(res.status).toBe(429);
  });

  it("a successful login resets the counter", async () => {
    const email = await newLoginUser();
    await login(email, WRONG_PASSWORD);
    await login(email, WRONG_PASSWORD);

    expect((await login(email, PASSWORD)).status).toBe(200);

    const res = await login(email, WRONG_PASSWORD);
    expect(res.body.attemptsLeft).toBe(4);
  });

  it("locks one account without affecting another", async () => {
    const locked = await newLoginUser();
    const other = await newLoginUser();
    for (let i = 0; i < 5; i++) await login(locked, WRONG_PASSWORD);

    expect((await login(locked, PASSWORD)).status).toBe(429);
    expect((await login(other, PASSWORD)).status).toBe(200);
  });

  it("answers an unknown email exactly like a wrong password", async () => {
    const known = await newLoginUser();
    const wrongPassword = await login(known, WRONG_PASSWORD);
    const unknownEmail = await login(`nobody-${randomUUID()}@example.com`, WRONG_PASSWORD);

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });
});
