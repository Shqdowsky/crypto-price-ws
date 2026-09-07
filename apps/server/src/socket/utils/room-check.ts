import { VALID_ROOMS, type RoomName } from "../../shared/constants.js";


export function isValidRoom(room: unknown): room is RoomName {
    return typeof room === "string" && VALID_ROOMS.has(room as RoomName);
}