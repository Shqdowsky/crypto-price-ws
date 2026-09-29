import type { RoomName } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { useState } from "react";
import { ErrorMessage } from "./ErrorMessage";


interface TradePanelProps {
    token: RoomName;
}

export function TradePanel({ token }: TradePanelProps){
    const { trade, state } = useSocketContext();
    const [pendingSide, setPendingSide] = useState<"buy" | "sell" | null>(null);

    const handleTrade = async(side: "buy" | "sell") => {
        setPendingSide(side);
        try{
            await trade(token, side);
        }catch(err){
            console.log(err)
        }
        setPendingSide(null)
    }

    const isPending = pendingSide !== null;

    return (
        <div className="trade-panel">
        {state.lastError && <ErrorMessage error={state.lastError} />}

        <div className="trade-buttons">
            <button
                className="trade-buy"
                onClick={() => handleTrade("buy")}
                disabled={isPending}
            >
                {pendingSide === "buy" ? "Buying..." : "Buy"}
            </button>

            <button
                className="trade-sell"
                onClick={() => handleTrade("sell")}
                disabled={isPending}
            >
                {pendingSide === "sell" ? "Selling..." : "Sell"}
            </button>
        </div>
        </div>
    );
}