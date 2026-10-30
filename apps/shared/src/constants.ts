export const ROOMS = {
	BTC: "btc",
	ETH: "eth",
	SOL: "sol",
	DOGE: "doge",
	BNB: "bnb",
	XRP: "xrp",
} as const;

export type RoomName = (typeof ROOMS)[keyof typeof ROOMS];

export const VALID_ROOMS = new Set<RoomName>(Object.values(ROOMS));

export const CLIENT_EVENTS = {
	SUBSCRIBE: "subscribe",
	UNSUBSCRIBE: "unsubscribe",
	GET_PRICE: "price:get",
	TRADE: "trade:execute",
	HISTORY: "trade:history",
	GET_ACCOUNT_STATE: "account:get",
	GET_POSITION_HISTORY: "position:history",
	GET_TRADE_HISTORY: "trade:history:token",
} as const;

export const SERVER_EVENTS = {
	PRICE_UPDATE: "price:update",
	PRICE_CURRENT: "price:current",
	TRADE_CONFIRM: "trade:confirm",
	HISTORY_RESULT: "trade:history:result",
	RATE_LIMITED: "rate-limited",
	ERROR: "error:general",
	ROOMS_RESTORED: "rooms:restore",
	BALANCE_UPDATED: "balance:update",
	ACCOUNT_STATE: "account:state",
	FUNDING_REVIEWED: "funding:reviewed",
} as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
export type ServerEvent = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

export const PRICE_CONFIG = {
	TICK_INTERVAL_MS: 1000,
	MAX_DRIFT: 0.005,
	MIN_PRICE: 0.000001,

	INITIAL_PRICES: {
		[ROOMS.BTC]: 65000,
		[ROOMS.ETH]: 1700,
		[ROOMS.SOL]: 70,
		[ROOMS.DOGE]: 0.12,
		[ROOMS.BNB]: 600,
		[ROOMS.XRP]: 0.55,
	} as Record<RoomName, number>,
} as const;

export const RATE_LIMIT = {
	MAX_REQUESTS: 10,
	WINDOW_MS: 10000,
	REFILL_RATE: 1,
} as const;

export const CANDLE_INTERVALS = [1, 60, 300, 900, 3600] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];
export const CANDLE_PAGE_SIZE = 120;
export const CANDLE_MAX_PAGE_SIZE = 360;
export const CANDLE_WINDOW_MAX = 360; // client memory cap (3 pages)

// Seconds of history kept per interval; the cleanup job deletes older rows.
export const CANDLE_RETENTION_SEC: Record<CandleInterval, number> = {
	1: 30 * 60, // ≈ 1,800 points
	60: 26 * 3600, // ≈ 1,560
	300: 6 * 86400, // ≈ 1,728
	900: 16 * 86400, // ≈ 1,536
	3600: 63 * 86400, // ≈ 1,512
};

export const SHUTDOWN = {
	SHUTDOWN_TIMEOUT_MS: 10000,
	FORCE_EXIT_TIMEOUT_MS: 15_000,
} as const;
