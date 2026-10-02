export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number
    ){
        super(message);
        this.name = "AppError"
    }
}

export class TradeError extends Error {
    constructor(
        public code: "INSUFFICIENT_BALANCE" | "NO_OPEN_POSITION" | "SELL_EXCEEDS_POSITION" | "INVALID_TRADE_INPUT",
        message: string
    ){
        super(message);
        this.name = "TradeError";
    }
}

export interface ErrorResponse {
    code: string;
    message: string;
}

export type PgError = {
    code?: string;
    detail?: string;
    table?: string;
};


export function isPgError(error: unknown): error is PgError {
    return typeof error === "object" && error !== null && "code" in error;
}