# Load test report: WebSocket capacity on Heroku (Basic dyno)

Date: 2026-11-05. Target: `crypto-price-ws` on Heroku. Tool: k6, run from GitHub Actions (`load-test.yml`).

## Summary

- The app handles **at least 1500 concurrent WebSocket clients** on one Basic dyno with a database pool of 17. Median read/trade latency stays under 150 ms and there are zero ack timeouts.
- It **breaks at 2000 clients**: about 18% of requests hit the 5 s ack timeout, connect time P95 rises to about 9 s and about 11.5% of sockets are dropped mid-session. This reproduced on a freshly restarted dyno.
- The limit is the **database connection pool**, not Node's CPU. At 2000 clients up to about 10,700 queries were queued behind 17 connections, while event-loop P99 stayed at 65-84 ms.
- Raising the pool from 10 to 17 helped modestly at 1500 clients (queue depth about -40%, trade median 219 to 144 ms) but did not fix 2000.

## Setup

| Item         | Value                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| App          | Express + socket.io, one `web` dyno (Basic), Heroku Postgres (~20 conn. max)     |
| Load tool    | k6, `tests/k6-load-test.js`, GitHub-hosted runner (ubuntu-latest, 2 vCPU)        |
| Stages       | 20 s to 25%, 20 s to 50%, 20 s to 100%, hold (60-90 s), 15 s ramp-down           |
| Virtual user | registers a user, connects with a cookie, lives 30 s, one action every 1.5 s     |
| Actions      | `account:get`, `price:get`, buy, `trade:history:token`, sell, `position:history` |
| Server stats | `LOAD_STATS=1` logs event-loop lag and pool pressure every 5 s                   |

Thresholds: connect success above 90%, connect time P95 under 3 s, read P95 under 1 s, trade P95 under 1.5 s, fewer than 20 ack timeouts, read/trade success above 95%.

## Results

| VUs  | Pool | Dyno state                | Result   |
| ---- | ---- | ------------------------- | -------- |
| 500  | 10   | n/r                       | Pass     |
| 1000 | 10   | restarted (deploy)        | Pass     |
| 1500 | 10   | not restarted, after 2000 | **Fail** |
| 1500 | 10   | restarted (deploy)        | Pass     |
| 1500 | 17   | restarted                 | Pass     |
| 2000 | 10   | not restarted             | **Fail** |
| 2000 | 17   | restarted                 | **Fail** |

n/r: not recorded at the time (later server logs showed a pool of 10).

### Client-side metrics (k6)

| Run            | Connect success | Connect avg / P95 | Read median / P95 | Trade median / P95 | Ack timeouts | Trade success |
| -------------- | --------------- | ----------------- | ----------------- | ------------------ | ------------ | ------------- |
| 500            | 100%            | 0.54 / 0.61 s     | 132 / 186 ms      | 145 / 254 ms       | 0            | 99.87%        |
| 1000 (pool 10) | 100%            | 0.31 / 0.39 s     | 72 / 148 ms       | 81 / 197 ms        | 0            | 99.85%        |
| 1500 (first)   | 100%            | 2.56 / 5.0 s      | 1.47 s / 4.33 s   | 2.08 s / 4.38 s    | 979          | 98.75%        |
| 1500 (pool 10) | 100%            | 0.59 / 0.78 s     | 135 / 359 ms      | 219 / 403 ms       | 0            | 99.82%        |
| 1500 (pool 17) | 100%            | 0.55 / 0.70 s     | 127 / 268 ms      | 144 / 333 ms       | 0            | 99.40%        |
| 2000 (first)   | 89.4%           | 2.71 / 6.57 s     | 166 ms / 4.61 s   | 463 ms / 4.64 s    | 13,840       | 94.69%        |
| 2000 (pool 17) | 99.98%          | 4.08 / 8.81 s     | 870 ms / 4.43 s   | 2.75 s / 4.51 s    | 22,815       | 97.37%        |

Success rates do not count timed-out requests, so they understate the 2000 failures. Roughly 18-20% of requests timed out at 2000 clients. The 2000 (pool 17) run also closed 1086 sockets unexpectedly (about 11.5% of sessions); the cause was not identified.

### Server-side stats (`[loadstats]`, at full plateau)

| Run            | Event-loop P99 | Pool size | Pool idle    | Queued queries (peak per 5 s) |
| -------------- | -------------- | --------- | ------------ | ----------------------------- |
| 1000 (pool 10) | 19-37 ms       | 10        | 4-9          | 45-87                         |
| 1500 (pool 10) | 43-51 ms       | 10        | 0-8          | 247-541                       |
| 1500 (pool 17) | 34-50 ms       | 17        | mostly 0     | 121-351                       |
| 2000 (pool 17) | 65-84 ms       | 17        | 0 throughout | 5,149-10,729                  |

## Analysis

1. **The database pool is the bottleneck.** The queue grows 30x between 1500 and 2000 clients while all connections are busy. Event-loop lag stays low, so Node's CPU is not saturated.
2. **The slowdown is in the connect handshake and acks, not the network.** WebSocket upgrade time was about 0.3-0.4 s up to 1500 clients. The extra seconds happen after the upgrade (auth, room restore, `ACCOUNT_STATE`) and while waiting for DB-backed acks.
3. **Capacity estimate:** about 1,000-1,200 client requests per second with a pool of 17 (1500 clients offer about 1,000/s, 2000 offer about 1,330/s). This is an estimate from the runs, not a measured ceiling.
4. **The bigger pool did not fix 2000.** The share of timed-out requests was similar (about 20% with pool 10 vs about 18% with pool 17), although more requests were served in total.
5. **Timed-out requests still run on the server.** The `NO_OPEN_POSITION` errors seen only at 2000 are consistent with sells that timed out on the client but executed late. Dead requests keep using the pool.
6. **Queries are cheap; connections are held long.** On the app's own database role, the 28 statements averaged 0.02-1.67 ms (top: `trades` history lookup, 1.67 ms). A trade is a transaction of about 7 statements, so connection hold time is likely dominated by network round trips, not execution. This is an inference, not a measurement.
7. **Run-to-run variance is large.** The first 1500 run (right after the 2000 failure, no restart) was far worse than later 1500 runs with the same pool setting. Likely causes are leftover process state or shared infrastructure (Heroku Essential Postgres is multi-tenant). Not proven.
8. **Price-related errors** (`NO_PRICE_DATA`, `PRICE_UNAVAILABLE`) stay at 0.1-0.5% up to 1500 clients. They follow gaps in the thin Binance feeds (doge, xrp, sol: P99 gaps of 5-14 s at every load level), not server load.

## Caveats

- One run per configuration; the shared Basic dyno and shared Postgres add noise.
- The k6 runner's own CPU was not measured. Stable BTC price gaps suggest it kept up, but this is indirect.
- The `pg_stat_statements` view also contained a large volume of statements from other roles whose text was hidden. It was not determined whether they belong to other tenants.
- Each run creates throwaway `k6load-*@example.com` users and trades (about 10,000 users across these runs). Clean them up, and check foreign keys first.

## Reproducing

1. Optional: `heroku config:set LOAD_STATS=1 -a crypto-price-ws` and `heroku logs --tail -a crypto-price-ws | grep loadstats`.
2. Actions tab, "Load test", Run workflow with `base_url` (full `https://...` URL), `peak` and `hold`.
3. For comparable runs, `heroku ps:restart` first, and start with a low `peak` (for example 20) to confirm the setup.
4. Afterwards: `heroku config:unset LOAD_STATS`.
