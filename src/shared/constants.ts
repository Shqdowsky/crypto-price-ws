export const ROOMS = {
  BTC: 'btc',
  ETH: 'eth',
  SOL: 'sol',
  DOGE: 'doge',
  BLYAMBA: 'blyamba'
} as const;

export type RoomName = typeof ROOMS[keyof typeof ROOMS];

export const VALID_ROOMS = new Set<RoomName>(Object.values(ROOMS));

export const CLIENT_EVENTS = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  GET_PRICE: 'price:get',
  TRADE: 'trade:execute', 
  HISTORY: 'trade:history',
} as const;

export const SERVER_EVENTS = {
  PRICE_UPDATE: 'price:update',
  PRICE_CURRENT: 'price:current',
  TRADE_CONFIRM: 'trade:confirm', 
  HISTORY_RESULT: 'trade:history:result',
  RATE_LIMITED: 'rate-limited',
  ERROR: 'error:general',  
} as const;

export type ClientEvent = typeof CLIENT_EVENTS[keyof typeof CLIENT_EVENTS];
export type ServerEvent = typeof SERVER_EVENTS[keyof typeof SERVER_EVENTS];

export const PRICE_CONFIG = {
    TICK_INTERVAL_MS: 1000,
    MAX_DRIFT: 0.005,
    MIN_PRICE: 0.000001,

    INITIAL_PRICES: {
      [ROOMS.BTC]: 65000,
      [ROOMS.ETH]: 1700,
      [ROOMS.SOL]: 70,
      [ROOMS.DOGE]: 0.12,
      [ROOMS.BLYAMBA]: 167693310
    } as Record<RoomName, number>,
} as const;

export const RATE_LIMIT = {
  MAX_REQUESTS: 10,
  WINDOW_MS: 10000,
  REFILL_RATE: 1
} as const;

export const SHUTDOWN = {
  SHUTDOWN_TIMEOUT_MS: 10000,
  FORCE_EXIT_TIMEOUT_MS: 15_000
} as const;