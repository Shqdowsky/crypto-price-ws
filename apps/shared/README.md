# Shared

`@crypto-price-ws/shared` holds the types and constants that the server and the client both use: socket event names, payload types, room names, price settings, candle types and error classes.

Nothing here runs on its own. It's a library that the other two apps import.

## Contents

| Path                        | What it holds                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/constants.ts`          | `ROOMS` (the token list), `CLIENT_EVENTS`, `SERVER_EVENTS`, candle intervals and retention, rate-limit and shutdown settings |
| `src/types/socket.types.ts` | Socket.IO event maps and payload types (`TradeConfirm`, `AccountState`, `TokenPayload`, ...)                                 |
| `src/types/candle.ts`       | `Candle` and `CandlePage`                                                                                                    |
| `src/types/funding.ts`      | Funding request types and statuses                                                                                           |
| `src/types/user.type.ts`    | User types (`PublicUser`, `UserRole`)                                                                                        |
| `src/types/auth.ts`         | Auth request and response types                                                                                              |
| `src/types/error.ts`        | `AppError`, `TradeError` and error response shapes                                                                           |

Everything is re-exported from `src/index.ts`.

## Building

The server and the client import the compiled output in `dist/`, not the TypeScript source. Build this package before you run or check either app:

```sh
npm run build --workspace=apps/shared
```

Run this again after every change here. If you skip it, the other apps keep using the old types and can fail in confusing ways. CI runs this build before its lint, typecheck and test steps.

## Making changes

- Add an event name to `CLIENT_EVENTS` or `SERVER_EVENTS`, then add its payload to the matching event map in `socket.types.ts`. Both sides get the same names and types.
- Add a room to `ROOMS`. The server's price feed and the client's token page both read that list.
- Keep this package free of runtime dependencies. It should only hold types and constants.

## Scripts

```sh
npm run build --workspace=apps/shared       # compile to dist/
npm run typecheck --workspace=apps/shared   # type-check without writing files
npm run lint --workspace=apps/shared
```
