import type { RoomName } from "@crypto-price-ws/shared";
import { env } from "../config/env.js";
import type { PriceSource } from "./price-source.js";
import { createBinanceSource } from "./binance-source.js";
import { createSimulatedSource } from "./simulated-source.js";

interface TokenState {
  price: number;
  PDChange: number;
  updatedAt: number;
}

const tokenMap = new Map<RoomName, TokenState>();
const source: PriceSource =
  env.PRICE_SOURCE === "simulated" ? createSimulatedSource() : createBinanceSource();

function initTokenMap(): void {
  tokenMap.clear();
  const now = Date.now();
  for (const [room, price] of source.initialPrices()) {
    tokenMap.set(room, { price, PDChange: 0, updatedAt: now });
  }
}

function startPriceLoop(onTick: (room: RoomName, state: TokenState) => void): void {
  source.start((room, price, PDChange) => {
    const state: TokenState = { price, PDChange, updatedAt: Date.now() };
    tokenMap.set(room, state);
    onTick(room, state);
  });
}

function stopPriceLoop(): void {
  source.stop();
}

function getPrice(room: RoomName): TokenState | undefined {
  const state = tokenMap.get(room);
  if (!state) return undefined;
  if (Date.now() - state.updatedAt > source.maxAgeMs) return undefined;
  return state;
}

export { initTokenMap, startPriceLoop, stopPriceLoop, getPrice };
