export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number
    ){
        super(message);
        this.name = "AppError"
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