export declare const ROOMS: {
    readonly BTC: "btc";
    readonly ETH: "eth";
    readonly SOL: "sol";
    readonly DOGE: "doge";
    readonly BLYAMBA: "blyamba";
};
export type RoomName = typeof ROOMS[keyof typeof ROOMS];
export declare const VALID_ROOMS: Set<RoomName>;
export declare const CLIENT_EVENTS: {
    readonly SUBSCRIBE: "subscribe";
    readonly UNSUBSCRIBE: "unsubscribe";
    readonly GET_PRICE: "price:get";
    readonly TRADE: "trade:execute";
    readonly HISTORY: "trade:history";
};
export declare const SERVER_EVENTS: {
    readonly PRICE_UPDATE: "price:update";
    readonly PRICE_CURRENT: "price:current";
    readonly TRADE_CONFIRM: "trade:confirm";
    readonly HISTORY_RESULT: "trade:history:result";
    readonly RATE_LIMITED: "rate-limited";
    readonly ERROR: "error:general";
};
export type ClientEvent = typeof CLIENT_EVENTS[keyof typeof CLIENT_EVENTS];
export type ServerEvent = typeof SERVER_EVENTS[keyof typeof SERVER_EVENTS];
export declare const PRICE_CONFIG: {
    readonly TICK_INTERVAL_MS: 1000;
    readonly MAX_DRIFT: 0.005;
    readonly MIN_PRICE: 0.000001;
    readonly INITIAL_PRICES: Record<RoomName, number>;
};
export declare const RATE_LIMIT: {
    readonly MAX_REQUESTS: 10;
    readonly WINDOW_MS: 10000;
    readonly REFILL_RATE: 1;
};
export declare const SHUTDOWN: {
    readonly SHUTDOWN_TIMEOUT_MS: 10000;
    readonly FORCE_EXIT_TIMEOUT_MS: 15000;
};
//# sourceMappingURL=constants.d.ts.map