import { configureStore } from "@reduxjs/toolkit";
import { socketReducer } from "./socketReducer";

export function createSocketStore() {
	return configureStore({ reducer: { socket: socketReducer } });
}

export type SocketStore = ReturnType<typeof createSocketStore>;
export type RootState = ReturnType<SocketStore["getState"]>;
export type AppDispatch = SocketStore["dispatch"];
