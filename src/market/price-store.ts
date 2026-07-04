import { ROOMS, PRICE_CONFIG, type RoomName } from "../shared/constants.js";

interface TokenState {
    price: number;
    updatedAt: number;
}

let tokenMap = new Map<RoomName, TokenState>();

function initTokenMap(): void{
    for (let room of Object.values(ROOMS)){
        tokenMap.set(room, {
            price: PRICE_CONFIG.INITIAL_PRICES[room],
            updatedAt: Date.now(),
        });
    }
}

function nextPrice(current: number): number {
    const drift = (Math.random() * 2 - 1) * PRICE_CONFIG.MAX_DRIFT
    const price = current * (1 + drift);
    return Math.max(PRICE_CONFIG.MIN_PRICE, price)
}

function startPriceLoop(onTick: (room: RoomName, state: TokenState) => void): void {
    setInterval(() => {
        for(const [room, state] of tokenMap){
            const updated: TokenState = {
                price: nextPrice(state.price),
                updatedAt: Date.now()
            }
            tokenMap.set(room,updated);
            onTick(room, updated);
        }
    }, PRICE_CONFIG.TICK_INTERVAL_MS);
}

function getPrice(room: RoomName): TokenState | undefined {
    return tokenMap.get(room);
}

// initTokenMap();
// startPriceLoop((room, state) => console.log(room, state))

export { initTokenMap, startPriceLoop, getPrice };