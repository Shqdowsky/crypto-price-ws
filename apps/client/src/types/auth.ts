import type {PublicUser} from "@crypto-price-ws/shared"

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: PublicUser }
  | { status: "unauthenticated" }