import type { RoomName } from "@crypto-price-ws/shared";

export interface PriceSource {
  readonly maxAgeMs: number;
  initialPrices(): Map<RoomName, number>;
  start(onPrice: (room: RoomName, price: number) => void): void;
  stop(): void;
}
