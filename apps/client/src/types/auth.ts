import type {PublicUser} from "@crypto-price-ws/shared"

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: PublicUser }
  | { status: "unauthenticated" }

export interface LoginCredentials {
  email: string,
  password: string
}

export type RegisterCredentials = {
  username: string;
  email: string;
  password: string;
};