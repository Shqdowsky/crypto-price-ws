import { PRICE_CONFIG, ROOMS, type RoomName } from "@crypto-price-ws/shared";
import type { PriceSource } from "./price-source.js";

function nextPrice(current: number): number {
  const drift = (Math.random() * 2 - 1) * PRICE_CONFIG.MAX_DRIFT;
  return Math.max(PRICE_CONFIG.MIN_PRICE, current * (1 + drift));
}

export function createSimulatedSource(): PriceSource {
  const prices = new Map<RoomName, number>();
  const openPrices = new Map<RoomName, number>();
  let timer: NodeJS.Timeout | null = null;

  const seed = () => {
    prices.clear();
    openPrices.clear();
    for (const room of Object.values(ROOMS)) {
      const initial = PRICE_CONFIG.INITIAL_PRICES[room];
      prices.set(room, initial);
      openPrices.set(room, initial);
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
          const open = openPrices.get(room) ?? next;
          const PDChange = open === 0 ? 0 : ((next - open) / open) * 100;
          onPrice(room, next, PDChange);
        }
      }, PRICE_CONFIG.TICK_INTERVAL_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
