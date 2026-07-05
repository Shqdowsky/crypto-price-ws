# crypto-price-ws

A real-time cryptocurrency price tracking server built with **socket.io**, **TypeScript**, and **PostgreSQL**. Simulates live token prices broadcast to subscribed clients, supports trade execution and history, includes graceful shutdown, per-socket rate limiting, and JWT authentication.

Built as a 7-day learning project to explore WebSocket architecture, connection lifecycle management, and load testing.

---

## Features

- **Live price simulation** — BTC, ETH, SOL, DOGE, BLYAMBA ( a joke ) prices update every second via an in-memory Map, broadcast to subscribed room members
- **On-demand price requests** — clients can request the current price outside of the broadcast cycle
- **Trade execution** — buy/sell recorded to PostgreSQL using the live Map price at the moment of execution
- **Trade history** — fetch all past trades by authenticated user
- **JWT authentication** — all socket connections require a valid token via socket.io handshake
- **Token bucket rate limiting** — per-socket rate limiter on price:get requests with smooth refill
- **Graceful shutdown** — waits for in-flight DB operations to complete before closing sockets, then drains the PostgreSQL pool
- **Console client** — readline-based CLI for manual testing
- **k6 load tested** — validated up to 1000 concurrent WebSocket connections

---

## Architecture

### Event flow

```
Client                          Server                        PostgreSQL
──────                          ──────                        ──────────
connect ──────────────────────► io.use(authMiddleware)
                                  verify JWT
                                  findUserById()  ──────────► SELECT users
                                  socket.data.user = user
                                emit 'connection'

subscribe { token } ──────────► socket.join(room)
                                getPrice(room) [Map read]
◄─────────────────────────────── price:current { token, price, ts }

                                setInterval tick (1s)
                                  nextPrice() mutates Map
◄─────────────────────────────── price:update { token, price, ts }
                                  → broadcast to room only

price:get { token } ──────────► checkRateLimit(socket.id)
                                getPrice(room) [Map read]
◄─────────────────────────────── price:current { token, price, ts }

trade:execute { token, side } ► getPrice(token) [Map read]
                                insertTrade()   ──────────► INSERT trades
                                                ◄────────── row
◄─────────────────────────────── trade:confirm { id, token, side, price }

trade:history ────────────────► getTradesByUserId() ──────► SELECT trades
◄─────────────────────────────── trade:history:result { trades[] }

disconnect ───────────────────► clearRateLimit(socket.id)
                                cleanupSocket(socket.id)
                                socket.io removes from all rooms
```

---

## Socket events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe` | `RoomName` | Join a token room, receive immediate current price |
| `unsubscribe` | `RoomName` | Leave a token room |
| `price:get` | `RoomName` | Request current price on demand (rate limited) |
| `trade:execute` | `{ token: RoomName, side: 'buy' \| 'sell' }` | Execute a trade at the current live price |
| `trade:history` | — | Fetch all trades for the authenticated user |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `price:update` | `TokenPayload` | Broadcast to room every tick (1s) |
| `price:current` | `TokenPayload` | Response to `subscribe` or `price:get` |
| `trade:confirm` | `TradeConfirm` | Trade written to DB successfully |
| `trade:history:result` | `{ trades: TradeRow[] }` | Trade history result |
| `rate-limited` | `{ retryAfterMs: number }` | Rate limit exceeded on `price:get` |
| `error:general` | `{ code: string, message: string }` | Server-side error |

---

### Environment variables

Create a `.env` file in the project root:

```env
WS_PORT=8080
JWT_SECRET=your_jwt_secret_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crypto_ws
DB_USER=postgres
DB_PASSWORD=your_db_password
```

Available commands once connected:

```
join <token>     — subscribe to a room       (e.g. join btc)
leave <token>    — unsubscribe from a room
price <token>    — request current price
buy <token>      — execute a buy trade
sell <token>     — execute a sell trade
history          — fetch your trade history
exit             — disconnect and quit
```

Supported tokens: `btc`, `eth`, `sol`, `doge`, `blyamba`

---

## Price simulation

Prices are seeded at startup from hardcoded initial values and updated every second using a multiplicative random walk:

```
price = price × (1 + random(-0.005, 0.005))
price = max(price, MIN_PRICE)
```

Each tick applies a random drift of ±0.5% to the previous price, clamped to never go negative. This produces realistic-looking movement without any external data source.

---

## Rate limiting

`price:get` requests are rate limited per socket using a **token bucket** algorithm:

- **Capacity:** 10 tokens (maximum burst)
- **Refill rate:** 1 tokens/second
- Buckets are created on first request and cleaned up on disconnect — no memory leaks

When the limit is exceeded the server emits `rate-limited` with a `retryAfterMs` value calculated from the bucket's current state.

---

## Graceful shutdown

On `SIGTERM` or `SIGINT`:

1. Set `isShuttingDown = true` — new trade requests are rejected immediately
2. Notify all connected clients via `server_shutdown` event
3. For each socket: wait up to `SHUTDOWN_TIMEOUT_MS` (10s) for in-flight DB operations to complete, then disconnect
4. Close the socket.io server
5. Drain the PostgreSQL connection pool
6. Exit cleanly

A `FORCE_EXIT_TIMEOUT_MS` (15s) hard deadline ensures the process always exits even if something hangs.

In-flight operations are tracked per socket via `incrementPending()` / `decrementPending()` called around every `await pool.query()` in trade handlers.

---

## Performance

Load tested with [k6](https://k6.io) using raw WebSocket protocol against the socket.io server. Each virtual user connects with a JWT, subscribes to a random token room, waits for price broadcasts, executes one trade, then disconnects.

### Results

| VUs | Connection rate | Trade success | Trade p(95) | Trade max | Price p(95) |
|-----|----------------|---------------|-------------|-----------|-------------|
| 300 | 100% | 100% | 143ms | 255ms | 43ms |
| 500 | 100% | 100% | 129ms | 246ms | 37ms |
| 750 | 100% | 100% | 132ms | 194ms | 39ms |
| 1000 | 100% | 100% | 152ms | 232ms | 51ms |

### Observations

- Zero connection failures or server errors across all load levels
- Trade confirmation latency (DB write + socket emit roundtrip) stayed under **155ms p(95)** at all tested VU counts
- Price broadcast latency remained under **55ms p(95)** at 1000 concurrent connections — the in-memory Map broadcast loop does not block under load
- `trade_latency max` stayed under 260ms across all runs — no pool contention observed
- No degradation point found at 1000 VUs on local hardware; the server scales linearly across the tested range
- To find the true ceiling, higher VU counts or a dedicated cloud load testing environment would be needed (the k6 runner and server share the same machine in these tests)

### Load test stages

```javascript
{ duration: '20s', target: 100  },
{ duration: '30s', target: 1000 },
{ duration: '45s', target: 1000 },
{ duration: '15s', target: 0    },
```

### Test environment

- Server and k6 runner on the same local machine
- PostgreSQL local install, `max_connections` default (100)
- PostgreSQL pool `max: 50`


## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| WebSocket server | socket.io v4 |
| HTTP framework | Express |
| Database | PostgreSQL + node-postgres (pg) |
| Authentication | JWT (jsonwebtoken) + bcrypt |
| Validation | Zod |
| Load testing | k6 |

---

This is a learning project, not a trading platform.
