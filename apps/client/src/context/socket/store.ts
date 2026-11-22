import { configureStore } from "@reduxjs/toolkit";
import { socketReducer } from "./socketReducer";

// One store per SocketProvider mount, so a logout/login never sees the previous user's data.
export function createSocketStore() {
	return configureStore({ reducer: { socket: socketReducer } });
}

export type SocketStore = ReturnType<typeof createSocketStore>;
export type RootState = ReturnType<SocketStore["getState"]>;
export type AppDispatch = SocketStore["dispatch"];
