export interface Candle {
	time: number; // bucket start, epoch ms (UTC)
	open: number;
	high: number;
	low: number;
	close: number;
}

export interface CandlePage {
	candles: Candle[]; // always ascending by time
	hasMore: boolean; // more rows exist in the requested direction
}
