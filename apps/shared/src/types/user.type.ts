import { Position } from "./socket.types.js";

export type UserRole = "user" | "admin";

export interface IUser {
  id: number;
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export type PublicUser = Omit<IUser, "password">;

export interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  balance: string;
  createdAt: string;
  openPositionsCount: number;
}

export interface AdminUsersPage {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  openPositions: Position[];
  closedPositions: Position[];
}
