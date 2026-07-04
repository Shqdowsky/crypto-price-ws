import { RATE_LIMIT } from "../../shared/constants.js";

export class TokenBucket {
    private tokens: number;
    private lastRefill: number;

    constructor( private capacity: number, private refilRate: number){
        this.tokens = capacity,
        this.lastRefill = Date.now();
    }

    consume(): boolean{
        this._refill();

        if(this.tokens >= 1){
            this.tokens-=1;
            return true;
        }

        return false;
    }

    private _refill(): void{
        const tokensToAdd = ((Date.now() - this.lastRefill) / 1000 ) * this.refilRate;
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = Date.now();
    }

    retryAfterMs(): number{
        if(this.tokens >= 1){
            return 0;
        }
        return Math.ceil((1 - this.tokens) / this.refilRate) * 1000;
    }
}

const clientBuckets = new Map<string, TokenBucket>();

export function checkRateLimit(socketId: string): { allowed: boolean; retryAfterMs: number } {
    let bucket = clientBuckets.get(socketId);
    if(!bucket){
        bucket = new TokenBucket(RATE_LIMIT.MAX_REQUESTS, RATE_LIMIT.REFILL_RATE);
        clientBuckets.set(socketId, bucket);
    }

    const allowed = bucket.consume();
    return {allowed, retryAfterMs: allowed ? 0: bucket.retryAfterMs()};
}

export function clearRateLimit(socketId: string): void {
    clientBuckets.delete(socketId);
}