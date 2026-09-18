import { useSocketContext } from "../context/socket/SocketProvider";

export function Dashboard() {
  const { state } = useSocketContext();

  return (
    <div>
      <p>Connection status: {state.connectionStatus}</p>
    </div>
  );
}