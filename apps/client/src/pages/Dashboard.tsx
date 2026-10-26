import { Link } from "react-router";
import { ROOMS } from "@crypto-price-ws/shared";
import { useSocketContext } from "../context/socket/SocketProvider";
import { ErrorMessage } from "../components/ErrorMessage";

const ROOM_OPTIONS = Object.values(ROOMS);

export function Dashboard() {
  const { state } = useSocketContext();

  return (
    <div className="dashboard">
      <p>Connection: {state.connectionStatus}</p>

      {state.lastError && <ErrorMessage error={state.lastError} />}

      <section>
        <h2>Markets</h2>
        <div className="room-grid">
          {ROOM_OPTIONS.map((room) => {
            const price = state.prices[room];

            return (
              <Link to={`/token/${room}`} key={room} className="room-card">
                <div className="room-card-header">
                  <strong>{room.toUpperCase()}</strong>
                </div>
                <div className="room-card-price">
                  {price ? `$${price.price.toFixed(2)}` : "waiting for price..."}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}