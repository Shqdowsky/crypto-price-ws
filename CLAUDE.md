# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

npm-workspaces monorepo (`crypto-price-ws`) for a real-time crypto price / paper-trading app:

- `apps/server` — Express + socket.io + PostgreSQL (ESM, TypeScript, run with `tsx`)
- `apps/client` — React 19 + Vite + React Query + socket.io-client (React Compiler enabled via babel preset)
- `apps/shared` — `@crypto-price-ws/shared`: types, socket event names (`CLIENT_EVENTS` / `SERVER_EVENTS`), constants, `TradeError`. Consumed from its **built `dist/`**, so run `npm run build --workspace=apps/shared` after changing it (CI does this before lint/typecheck/tests).

`apps/server/README.md` is partly outdated (mentions a console client `src/client.ts` that no longer exists, a `blyamba` token, and a bearer-token handshake). Trust the code over the README.

## Commands

Run from the repo root:

```sh
npm ci
npm run build --workspace=apps/shared        # required before server/client typecheck or tests
npm run format:check                         # prettier (CI enforces); `npm run format` to fix
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present

npm run dev:server --workspace=apps/server   # tsx watch src/server.ts (needs apps/server/.env)
npm run dev --workspace=apps/client          # vite (needs VITE_SERVER_URL)

npm run test --workspace=apps/client         # vitest, jsdom
npm run test --workspace=apps/server         # pretest runs migrations against the test DB first
npm run test:coverage --workspace=apps/server
npm run migrate --workspace=apps/server      # apply migrations to the dev DB
```

Single server test (from `apps/server`): `npx vitest run tests/integration/trade.service.test.ts -t "test name"`. Calling vitest directly skips `pretest`, so run `npm run migrate:test` first if the schema changed.

Server tests are integration tests that need a real Postgres matching `apps/server/.env.test` (`crypto_test` on localhost:5432, postgres/postgres). `tests/setup/env-setup.ts` loads `.env.test` with override; `.env.test` sets `PRICE_SOURCE=simulated`. Tests create their own users through `tests/support/helpers.ts` and remove them afterwards. They do not truncate tables.

k6 load test: `tests/k6-load-test.js`.

## Server architecture

`src/server.ts` wires everything to a single HTTP server: the Express app (`src/http/app.ts`: `/auth`, `/admin`, `/funding-requests`) and the socket.io `Server` attached to it, both on `WS_PORT`, with CORS restricted to `CLIENT_URL` and credentials enabled.

**Config**: `src/config/env.ts` throws at import time if any required env var is missing (including `PRICE_SOURCE`, `CLIENT_URL`, `WS_URL`, and the token max-ages). It skips `dotenv` when `NODE_ENV=test`.

**Auth**: JWT access token in the `token` httpOnly cookie, plus the `refresh_token` cookie (`src/http/utils/authCookie.ts`, `refreshToken.ts`). The socket handshake (`socket/middleware/auth.middleware.ts`) parses the cookie header and does not use `auth` payloads. Login brute-force protection is in `http/service/login-throttle.ts`. On the client, `utils/authFetch.ts` retries once after `refreshAccessToken()` when it gets a 401.

**Market data** (`src/market/`): the `PriceSource` interface (`initialPrices`, `start`, `stop`, `maxAgeMs`) has two implementations, picked by `PRICE_SOURCE`:
- `simulated-source.ts`: a random walk
- `binance-source.ts`: the Binance combined `miniTicker` WebSocket, with exponential-backoff reconnect and a silence watchdog

`price-store.ts` holds the in-memory `Map<RoomName, {price, updatedAt}>`. `getPrice()` returns `undefined` when the price is older than `source.maxAgeMs`, and trades must treat that as "price unavailable". Each tick, `server.ts` broadcasts `PRICE_UPDATE` to the matching room. Room names are lowercase tokens; the valid set is `VALID_ROOMS` in shared constants, checked by `socket/utils/room-check.ts`.

**Sockets** (`src/socket/`):
- On connection, a socket joins `user:<id>` (`notifier.ts`, used for server-pushed funding/balance events from HTTP admin actions) and re-joins the rooms the user subscribed to before, which are stored in the DB (`room-subscription.service.ts`). It then emits `ROOMS_RESTORED` and `ACCOUNT_STATE`.
- `socket.use(rateLimitPacketMiddleware)` adds a per-socket token bucket. Stale buckets are pruned on an interval.
- Handlers are in `handlers/`; business logic is in `services/`. Client calls use socket.io acks (`AckResponse` in shared).

**Trades** (`services/trade.service.ts`): all money and quantity math uses `decimal.js` (qty and price use 8 dp, PnL uses 2 dp). Values pass through as strings to and from pg `NUMERIC`. A trade runs in one transaction that locks the user row with `SELECT … FOR UPDATE` and updates balance, positions, and trade history. A buy that hits a unique violation (`23505`, a race on position creation) is retried up to `MAX_RETRIES`.

**Graceful shutdown** (`socket/utils/shutdown.ts`): trade handlers wrap DB work in `incrementPending`/`decrementPending`, and `getIsShuttingDown()` rejects new trades. On SIGTERM/SIGINT the server waits for pending work on each socket (10s), disconnects, closes io, and drains the pg pool. A hard exit fires after 15s. New async DB work in socket handlers must follow the same pattern.

**DB / migrations**: plain SQL files in `apps/server/migrations/`, applied in sorted filename order by `src/scripts/migrate.ts` and tracked in `schema_migrations`. Each file runs in its own transaction. Add new files (`001_*.sql`, …) instead of editing `000_baseline.sql`.

## Client architecture

- `context/socket/SocketProvider.tsx` owns the single socket.io connection, built with `withCredentials` so the auth cookie is sent. Its state lives in a pure reducer (`socketReducer.ts`, which is also the unit-tested part). It exposes `joinRoom`, `leaveRoom`, `getPrice`, and `trade`, using ack timeouts (`VITE_ACK_TIMEOUT_MS`, default 5000). Funding/balance push events invalidate React Query caches.
- HTTP data (auth, admin, funding) goes through React Query hooks in `hooks/*Queries.ts` using `authFetch`.
- Routes are in `routes/AppRoutes.tsx`, with the `ProtectedRoute`, `AdminRoute`, and `PublicOnlyRoute` guards.

## CI

`.github/workflows/main.yml` runs on pushes to `main`/`development` and on PRs to `main`, using Node 24. It runs format check, lint, and typecheck (all workspaces), the client tests, and the server tests with coverage against a `postgres:16` service.
