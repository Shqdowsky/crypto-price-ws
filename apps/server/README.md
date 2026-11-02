# Server

The Express HTTP API and the Socket.IO server for the app. It also runs the price feed, stores price candles, and serves the built client in production.

````

## HTTP API

Authentication uses an `httpOnly` cookie named `token` for access and `refresh_token` for refresh.

| Method | Path                                  | Auth           | Purpose                                                             |
| ------ | ------------------------------------- | -------------- | ------------------------------------------------------------------- |
| POST   | `/auth/register`                      | none           | Create an account                                                   |
| POST   | `/auth/login`                         | none           | Log in (throttled after repeated failures)                          |
| POST   | `/auth/refresh`                       | refresh cookie | Issue a new access token                                            |
| GET    | `/auth/me`                            | access token   | Current user                                                        |
| POST   | `/auth/logout`                        | none           | Clear the cookies                                                   |
| GET    | `/candles/:token`                     | none           | Candle page: `interval`, `limit`, and `before` or `after` (Unix ms) |
| POST   | `/funding-requests`                   | user           | Request a balance top-up                                            |
| GET    | `/funding-requests/mine`              | user           | Your funding requests                                               |
| POST   | `/funding-requests/:id/cancel`        | user           | Cancel one of your pending requests                                 |
| GET    | `/admin/users`                        | admin          | List users                                                          |
| GET    | `/admin/users/:id`                    | admin          | User detail                                                         |
| GET    | `/admin/users/:id/trades`             | admin          | A user's trades                                                     |
| GET    | `/admin/treasury`                     | admin          | Treasury totals                                                     |
| GET    | `/admin/funding-requests`             | admin          | All funding requests                                                |
| POST   | `/admin/funding-requests/:id/approve` | admin          | Approve and credit the balance                                      |
| POST   | `/admin/funding-requests/:id/reject`  | admin          | Reject a request                                                    |

Candle intervals are `1`, `60`, `300`, `900` and `3600` seconds.

## Socket.IO

The socket connects to the same server. The handshake must include the `token` cookie. Without it, or with an invalid or expired token, the connection is refused.

On connect, the server joins the socket to every token room, sends `price:current` for each room that has a price, then sends `account:state`.

Events and payloads are defined in [apps/shared/src/constants.ts](../shared/src/constants.ts) and [apps/shared/src/types/socket.types.ts](../shared/src/types/socket.types.ts).

**Client to server** (most use an acknowledgement callback that returns `{ success, data?, error? }`):

| Event                 | Payload                                      | Returns                           |
| --------------------- | -------------------------------------------- | --------------------------------- |
| `price:get`           | token                                        | Current price and 24h change      |
| `trade:execute`       | `{ token, side: "buy" \| "sell", quantity }` | Trade result and updated position |
| `account:get`         | none                                         | Balance and positions             |
| `position:history`    | `{ token }`                                  | Closed positions for that token   |
| `trade:history:token` | `{ token }`                                  | Trades for that token             |

`quantity` is a positive number, or the string `"all"`. `"all"` spends the whole balance when buying, and closes the whole position when selling.

**Server to client:**

| Event              | Meaning                                                  |
| ------------------ | -------------------------------------------------------- |
| `price:update`     | New price for a token, sent to its room on every tick    |
| `price:current`    | Price snapshot, sent on connect                          |
| `balance:update`   | New balance after a trade or an approved funding request |
| `account:state`    | Balance and positions, sent on connect                   |
| `funding:reviewed` | A funding request was approved or rejected               |
| `rate-limited`     | Too many requests from this user                         |

Every user also joins a private room, `user:<id>`, so admin actions reach only that user's sockets.

## Trading rules

- Trades execute at the server's current price for the token. If no fresh price exists, the trade is rejected with `PRICE_UNAVAILABLE`.
- Each trade runs in one database transaction that locks the user's row, so two trades can't overspend the balance.
- Money math uses `decimal.js`. Quantities keep 8 decimal places and P&L keeps 2.
- Rate limit: a token bucket with a capacity of 10 requests and a refill of 1 request per second, per user.

## Price feeds

The `PriceSource` interface has two implementations, picked by `PRICE_SOURCE`:

- `simulated`: a random walk around starting prices. Useful offline.
- `binance`: Binance's public `miniTicker` WebSocket. It reconnects with exponential backoff and watches for silence.

Each price tick is written to memory, broadcast to the room, and folded into 1-second candles. Candle writes happen once per second, in one batch. Rollups build the larger intervals every 5 seconds, and a cleanup job deletes candles older than their retention.

## Database

Migrations are plain SQL files in `migrations/`, applied in filename order. Applied files are recorded in `schema_migrations`, and each file runs in its own transaction.

```sh
npm run migrate --workspace=apps/server        # apply to the database in .env
npm run migrate:test --workspace=apps/server   # apply to the test database in .env.test
````

To change the schema, add a new numbered file (for example `002_something.sql`). Don't edit an existing migration that has already run.

## Testing

The tests are integration tests against a real PostgreSQL database, using the settings in `.env.test`. They default to `crypto_test` on `localhost:5432`, user `postgres`, password `postgres`. Create that database before the first run.

Each test creates its own users and removes them afterwards. The tests don't truncate tables, so they can run alongside other data in the test database.

## Production notes

- With `NODE_ENV=production`, the server serves the built client from `apps/client/dist`.
- It trusts one proxy hop, so per-IP login throttling works behind a host router.
- `DATABASE_URL` is used with TLS (`rejectUnauthorized: false`), which some hosted Postgres services need.
- On `SIGTERM` or `SIGINT` the server stops taking trades, waits up to 10 seconds for in-flight work per socket, flushes the last candles, and closes the database pool. A hard exit follows after 15 seconds.
