import { PRICE_CONFIG, ROOMS, type RoomName } from "@crypto-price-ws/shared";
import type { PriceSource } from "./price-source.js";

function nextPrice(current: number): number {
  const drift = (Math.random() * 2 - 1) * PRICE_CONFIG.MAX_DRIFT;
  return Math.max(PRICE_CONFIG.MIN_PRICE, current * (1 + drift));
}

export function createSimulatedSource(): PriceSource {
  const prices = new Map<RoomName, number>();
  let timer: NodeJS.Timeout | null = null;

  const seed = () => {
    prices.clear();
    for (const room of Object.values(ROOMS)) {
      prices.set(room, PRICE_CONFIG.INITIAL_PRICES[room]);
    }
  };

  return {
    maxAgeMs: Number.POSITIVE_INFINITY,
    initialPrices() {
      seed();
      return new Map(prices);
    },
    start(onPrice) {
      if (prices.size === 0) seed();
      timer = setInterval(() => {
        for (const [room, current] of prices) {
          const next = nextPrice(current);
          prices.set(room, next);
          onPrice(room, next);
        }
      }, PRICE_CONFIG.TICK_INTERVAL_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
