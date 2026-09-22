import { useEffect, useRef } from "react";
import { useParams, Navigate, Link } from "react-router";
import { useSocketContext } from "../context/socket/SocketProvider";
import { VALID_ROOMS, type RoomName } from "@crypto-price-ws/shared";
import { ErrorMessage } from "../components/ErrorMessage";
import { PriceChart } from "../components/PriceChart";

export function TokenPage() {
    const { tokenName } = useParams<{ tokenName: string }>();
    const { state, joinRoom } = useSocketContext();
    const joinAttempted = useRef<RoomName | null>(null);

    const isValidToken = tokenName && VALID_ROOMS.has(tokenName as RoomName);
    const token = isValidToken ? (tokenName as RoomName) : null;
    const isJoined = token ? state.joinedRooms.has(token) : false;

    useEffect(() => {
        if (!token || isJoined) return;
        if (joinAttempted.current === token) return;

        joinAttempted.current = token;
        joinRoom(token);
    }, [token, isJoined, joinRoom]);

    if (!isValidToken || !token) {
        return <Navigate to="/" replace />;
    }

    const price = state.prices[token];
    const history = state.priceHistory[token] ?? [];

    return (
        <div>
            <Link to="/">&larr; Back to dashboard</Link>
            <h1>{token.toUpperCase()}</h1>

            {!isJoined && state.lastError && <ErrorMessage error={state.lastError} />}
            {!isJoined && <p>Joining {token.toUpperCase()}...</p>}
            {isJoined && (
                <>
                    <p>Current price: {price ? `$${price.price.toFixed(2)}` : "waiting for price..."}</p>
                    <PriceChart data={history} />
                </>
            )}
        </div>
    );
}