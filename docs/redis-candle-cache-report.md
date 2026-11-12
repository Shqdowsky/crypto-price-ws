# Redis candle cache: evaluation and decision

Date: 2026-11-13. Scope: Redis cache for `GET /candles/:token` (intervals 1m, 5m, 15m, 1h).

## Summary

- The cache was implemented and is correct and tested, but **in this project's conditions it does not make the endpoint faster, and under high load it makes it slower**.
- Measured locally (k6, Postgres baseline vs Redis in Docker): p95 latency rose from 13.06 ms to 38.33 ms at light load, and throughput fell from 742 to 531 requests/s at saturation.
- For the intended cloud setup (Heroku Basic dyno, Heroku Postgres, a hosted Redis with a free-tier ops cap) the expected result is no gain.
- **Decision: adding Redis here is a bad engineering trade-off.** It was built as a learning exercise to show the ability to implement a Redis cache.

## What was built

- One Redis sorted set per token and interval (`candles:<token>:<intervalSec>`). Score is the bucket start in ms, member is the ready-made candle JSON, so a response is built by joining strings.
- All candles of the four chart intervals are cached (about 6,300 per token), while 1s candles stay in Postgres.
- Postgres stays the source of truth. A read falls back to Postgres when Redis is off, down, or cannot prove it holds the whole page. Writes happen on every rollup, and the cache is warmed from Postgres at start and on every reconnect.
- `REDIS_URL` is optional. Without it nothing changes.

## Method

- Test: k6 against `GET /candles/:token`, 20 registered users, page size 120. Each session did one latest page, 3 `before` pages and 1 `after` page, across all four intervals.
- Environment: everything (k6, server, Postgres, Redis 7 in Docker Desktop) on one Windows machine, `PRICE_SOURCE=simulated`, database `crypto_test`.
- Runs: A 50 VUs with 500 ms think time (light load), B 500 VUs and C 1000 VUs with no think time (saturated). 100 s each.
- The data returned was the same in both setups (96.0 candles per response on average), and there were no failed requests.

## Results (measured)

| Run (VUs) | Metric | Postgres only | With Redis |
| --------- | ------ | ------------- | ---------- |
| A (50)    | req/s  | 77.95         | 76.02      |
| A (50)    | avg    | 6.69 ms       | 15.51 ms   |
| A (50)    | p95    | 13.06 ms      | 38.33 ms   |
| A (50)    | p99    | 17.96 ms      | 52.77 ms   |
| B (500)   | req/s  | 742.13        | 530.80     |
| B (500)   | avg    | 542.79 ms     | 772.42 ms  |
| B (500)   | p95    | 732.11 ms     | 1.69 s     |
| B (500)   | p99    | 796.37 ms     | 2.07 s     |
| C (1000)  | req/s  | 731.38        | 611.86     |
| C (1000)  | avg    | 1.11 s        | 1.33 s     |
| C (1000)  | p95    | 1.42 s        | 1.80 s     |
| C (1000)  | p99    | 1.50 s        | 1.90 s     |

Redis was slower in all three runs. At saturation, latency mostly reflects queue length, so the throughput drop (742 to 531 requests/s) is the clearer signal.

Sequential per-call timings on the same machine, outside k6:

| Per call            | Postgres | Redis   |
| ------------------- | -------- | ------- |
| bare round trip     | 0.26 ms  | 0.90 ms |
| `getCandles` latest | 1.35 ms  | 1.22 ms |
| `getCandles` before | 1.54 ms  | 1.20 ms |
| `getCandles` after  | 0.44 ms  | 1.19 ms |

## Why it does not help

1. **Postgres is already fast for this query.** One page is a single indexed keyset query that returns about 1 ms from a database that holds the whole table in memory. There is almost nothing for a cache to save.
2. **Redis is another network hop.** A cached page still costs one round trip, so it replaces one hop with another. On the local machine Redis's round trip was about 3.5 times slower than Postgres's (0.90 vs 0.26 ms).
3. **`after` pages got slower.** They need two Redis commands (the page plus the oldest cached entry) where Postgres needs one cheap query (1.19 vs 0.44 ms).
4. **Extra moving parts cost CPU and work.** The Redis client, the extra commands, and the constant rollup writes use resources on the same small machine.

The likely cause of the larger k6 slowdown is Docker Desktop's port forwarding, but this was not verified. A control run with the cache off under the same machine conditions was not done, so part of the gap could be machine state.

## Decision

- Redis stays in the code as a demonstration of a working cache layer: sorted sets, write-through on change, warm-up and re-warm on reconnect, safe fallback to Postgres, and tests against a real Redis in CI.
- If candle reads ever become a real bottleneck, the first steps should be a Postgres-side fix (query or index), a short in-process cache, or HTTP caching headers, before an external Redis.
