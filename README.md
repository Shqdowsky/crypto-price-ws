# crypto-price-ws

A learning pet project: a real-time crypto price feed with paper trading. The server streams prices over Socket.IO, and a React client shows live charts, lets you buy and sell at the current price, and tracks your positions and balance.

It's a learning project, not a trading platform. Balances are virtual.

**Live server:** https://crypto-price-ws.me/

## Features

- **Live prices** for BTC, ETH, SOL, DOGE, BNB and XRP, from Binance's public WebSocket feed.
- **Paper trading**: buy and sell at the live price, partial and full closes, realized P&L, and a "buy all" / "sell all" shortcut.
- **Candle charts**: 1-second candles stored in PostgreSQL and rolled up to 1-minute, 5-minute, 15-minute and 1-hour candles.
- **Accounts**: register and log in with JWT cookies, refresh tokens, and login throttling.
- **Admin tools**: manage users, review funding requests, and see the treasury.

## Stack

| Layer   | Technology                                                     |
| ------- | -------------------------------------------------------------- |
| Server  | Node.js, TypeScript, Express 5, Socket.IO, PostgreSQL (`pg`)   |
| Client  | React 19, TypeScript, Vite, React Query, Socket.IO client      |
| Shared  | TypeScript types, event names and constants used by both sides |
| Tooling | npm workspaces, Vitest, ESLint, Prettier                       |

## Repository layout

```
apps/
  server/   Express HTTP API, Socket.IO server, price feeds, migrations
  client/   React single-page app
  shared/   Types and constants imported by server and client
.github/    CI workflow
```

## Requirements

- **Node.js 24** (the version CI uses)
- **npm** (ships with Node)
- **PostgreSQL 16** (the version CI uses)

## Documentation

- [apps/server/README.md](apps/server/README.md): environment variables, HTTP API, Socket.IO events, migrations, tests
- [apps/client/README.md](apps/client/README.md): pages, state management, client environment variables
- [apps/shared/README.md](apps/shared/README.md): what the shared package contains and how to change it
