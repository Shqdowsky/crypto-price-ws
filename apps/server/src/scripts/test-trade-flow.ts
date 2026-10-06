// import { io } from "socket.io-client";
// import assert from "node:assert";
// import { env } from "../config/env.js";

// const TOKEN = "eth";
// const JWT =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAsInVzZXJuYW1lIjoidGVzdDIiLCJlbWFpbCI6InRlc3QyQGdtYWlsLmNvbSIsImlhdCI6MTc5MDcwNjk3NSwiZXhwIjoxNzkwNzA3ODc1fQ.A8FMws001TLKwBc1Ur03nlU_7irH1PRZxxO8kV_cOq4";

// console.log(env.WS_URL);

// const socket = io(env.WS_URL as string, {
//   withCredentials: true,
//   extraHeaders: { Cookie: `token=${JWT}` },
// });

// function emitAsync<T>(event: string, payload?: unknown): Promise<T> {
//   return new Promise((resolve, reject) => {
//     const args = payload === undefined ? [] : [payload];
//     socket.timeout(5000).emit(event, ...args, (err: Error, res: T) => {
//       if (err) reject(err);
//       else resolve(res);
//     });
//   });
// }

// async function main() {
//   socket.on("connect", async () => {
//     console.log("connected");

//     const state1 = await emitAsync<any>("account:get");
//     console.log("initial state:", state1);
//     assert.strictEqual(state1.data.openPositions.length, 0);

//     const buy1 = await emitAsync<any>("trade:execute", {
//       token: TOKEN,
//       side: "buy",
//       quantity: 0.1,
//     });
//     console.log("buy 1:", buy1);
//     assert(buy1.success);

//     const buy2 = await emitAsync<any>("trade:execute", {
//       token: TOKEN,
//       side: "buy",
//       quantity: 0.1,
//     });
//     console.log("buy 2 (avg cost should update):", buy2);

//     const state2 = await emitAsync<any>("account:get");
//     console.log("after 2 buys:", state2);
//     assert.strictEqual(state2.data.openPositions.length, 1);
//     assert.strictEqual(state2.data.openPositions[0].quantity, "0.20000000");

//     const partialSell = await emitAsync<any>("trade:execute", {
//       token: TOKEN,
//       side: "sell",
//       quantity: 0.1,
//     });
//     console.log("partial sell (position stays open):", partialSell);

//     const fullSell = await emitAsync<any>("trade:execute", {
//       token: TOKEN,
//       side: "sell",
//       quantity: 0.1,
//     });
//     console.log("full sell (position closes, realizedPnl set):", fullSell);
//     assert(fullSell.data.realizedPnl !== null);

//     const oversell = await emitAsync<any>("trade:execute", {
//       token: TOKEN,
//       side: "sell",
//       quantity: 1,
//     });
//     console.log("oversell (should reject, no open position):", oversell);
//     assert.strictEqual(oversell.success, false);
//     assert.strictEqual(oversell.error.code, "NO_OPEN_POSITION");

//     const hugeBuy = await emitAsync<any>("trade:execute", {
//       token: TOKEN,
//       side: "buy",
//       quantity: 999999999,
//     });
//     console.log("huge buy (should reject, insufficient balance):", hugeBuy);
//     assert.strictEqual(hugeBuy.error.code, "INSUFFICIENT_BALANCE");

//     console.log("ALL CHECKS PASSED");
//     socket.disconnect();
//     process.exit(0);
//   });

//   socket.on("connect_error", (err) => {
//     console.error("connect failed:", err.message);
//     process.exit(1);
//   });
// }

// main();
