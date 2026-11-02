# Client

The React single-page app for the crypto price feed: live charts, paper trading, account pages and admin tools.

## Requirements

- Node.js 24 (see the [root README](../../README.md))
- A running server (see [apps/server/README.md](../server/README.md))

## Pages and routes

Routes are defined in `src/routes/AppRoutes.tsx`.

| Path                | Page                          | Who can open it       |
| ------------------- | ----------------------------- | --------------------- |
| `/login`            | Login                         | Logged-out users only |
| `/register`         | Register                      | Logged-out users only |
| `/`                 | Dashboard                     | Logged-in users       |
| `/token/:tokenName` | Token (chart, trade, history) | Logged-in users       |
| `/account`          | Account                       | Logged-in users       |
| `/account/deposit`  | Request a deposit             | Logged-in users       |
| `/admin`            | Users                         | Admins                |
| `/admin/users/:id`  | User detail                   | Admins                |
| `/admin/funding`    | Funding requests              | Admins                |

Route guards live in `src/routes/guards/`: `ProtectedRoute`, `PublicOnlyRoute` and `AdminRoute`.

## How state is organized

- **Auth** (`src/context/auth/`): the current user and login state. Access and refresh tokens are cookies, so the client never reads them. `authFetch` retries a request once after a 401 by calling `/auth/refresh`.
- **Socket** (`src/context/socket/`): one Socket.IO connection for the whole app. Its state (prices, price history, balance and positions) is updated by a pure reducer in `socketReducer.ts`, which has unit tests. Trade and history calls use acknowledgements with a timeout.
- **Server data** (`src/hooks/`): HTTP data such as funding requests and admin lists goes through React Query hooks. Socket events that change this data invalidate the matching query.
- **Candle window** (`src/hooks/useCandleWindow.ts`): keeps at most 360 candles in memory for one token and interval. It loads older and newer pages as the user scrolls, and folds live ticks into the newest candle while the window is at the live edge.

The client uses the React Compiler through a Babel plugin, so components should follow the usual React rules (no mutating props or state during render).
