import pool from "../../config/db.js";
import bcrypt from "bcrypt";
import { AppError, InvalidCredentialsError } from "@crypto-price-ws/shared";
import { type IUser, type PublicUser } from "@crypto-price-ws/shared";

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<PublicUser> {
  const hashpass = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
        INSERT INTO users(username, email, password)
        VALUES($1, $2, $3)
        RETURNING id, username, email
    `,
    [username, email, hashpass],
  );
  const user = result.rows[0];
  if (!user) {
    throw new AppError("Some error with user registration", 401);
  }
  return user;
}

const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

export async function login(email: string, password: string): Promise<PublicUser> {
  const result = await pool.query<IUser>(
    "SELECT id, username, email, password, role FROM users WHERE email = $1",
    [email],
  );
  const candidate = result.rows[0];
  const isPassEquals = await bcrypt.compare(password, candidate?.password ?? DUMMY_HASH);
  if (!candidate || !isPassEquals) throw new InvalidCredentialsError();
  return {
    id: candidate.id,
    username: candidate.username,
    email: candidate.email,
    role: candidate.role,
  };
}
