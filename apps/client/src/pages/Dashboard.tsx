import { useState } from "react";
import { Link } from "react-router";
import { useSocketContext } from "../context/socket/SocketProvider";
import { ROOMS, type RoomName } from "@crypto-price-ws/shared";
import { ErrorMessage } from "../components/ErrorMessage";

const ROOM_OPTIONS = Object.values(ROOMS);

export function Dashboard() {
  const { state, joinRoom, leaveRoom } = useSocketContext();
  const [selectedRoom, setSelectedRoom] = useState<RoomName>(ROOM_OPTIONS[0]);
  const [pendingRoom, setPendingRoom] = useState<RoomName | null>(null);

  const handleJoin = async () => {
    setPendingRoom(selectedRoom);
    await joinRoom(selectedRoom);
    setPendingRoom(null);
  };

  const handleLeave = async (room: RoomName, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingRoom(room);
    await leaveRoom(room);
    setPendingRoom(null);
  };

  return (
    <div className="dashboard">
      <p>Connection: {state.connectionStatus}</p>

      {state.lastError && <ErrorMessage error={state.lastError} />}

      <section className="dashboard-join">
        <label htmlFor="room-select">Room</label>
        <select
          id="room-select"
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value as RoomName)}
        >
          {ROOM_OPTIONS.map((room) => (
            <option key={room} value={room}>
              {room.toUpperCase()}
            </option>
          ))}
        </select>

        <button
          onClick={handleJoin}
          disabled={state.joinedRooms.has(selectedRoom) || pendingRoom === selectedRoom}
        >
          {pendingRoom === selectedRoom ? "Joining..." : "Join"}
        </button>
      </section>

      <section>
        <h2>Joined rooms</h2>

        {state.joinedRooms.size === 0 && <p>No rooms joined yet.</p>}

        <div className="room-grid">
          {[...state.joinedRooms].map((room) => {
            const price = state.prices[room];

            return (
              <Link to={`/token/${room}`} key={room} className="room-card">
                <div className="room-card-header">
                  <strong>{room.toUpperCase()}</strong>
                  <button onClick={(e) => handleLeave(room, e)} disabled={pendingRoom === room}>
                    {pendingRoom === room ? "..." : "Leave"}
                  </button>
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