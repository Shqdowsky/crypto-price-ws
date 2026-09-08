export const ROOMS = {
    BTC: 'btc',
    ETH: 'eth',
    SOL: 'sol',
    DOGE: 'doge',
    BLYAMBA: 'blyamba'
};
export const VALID_ROOMS = new Set(Object.values(ROOMS));
export const CLIENT_EVENTS = {
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    GET_PRICE: 'price:get',
    TRADE: 'trade:execute',
    HISTORY: 'trade:history',
};
export const SERVER_EVENTS = {
    PRICE_UPDATE: 'price:update',
    PRICE_CURRENT: 'price:current',
    TRADE_CONFIRM: 'trade:confirm',
    HISTORY_RESULT: 'trade:history:result',
    RATE_LIMITED: 'rate-limited',
    ERROR: 'error:general',
};
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
    },
};
export const RATE_LIMIT = {
    MAX_REQUESTS: 10,
    WINDOW_MS: 10000,
    REFILL_RATE: 1
};
export const SHUTDOWN = {
    SHUTDOWN_TIMEOUT_MS: 10000,
    FORCE_EXIT_TIMEOUT_MS: 15_000
};
//# sourceMappingURL=constants.js.map