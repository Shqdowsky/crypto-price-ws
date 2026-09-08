import type { PublicUser } from "./user.type.js";

export interface ReqBody{
    username: string,
    email: string,
    password: string
}

export interface AuthResult {
    token: string,
    user: PublicUser
}

export interface AppJwtPayload {
    id: string;
    username: string;
    email: string;
}