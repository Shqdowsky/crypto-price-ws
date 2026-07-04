import pool from "../../config/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AppError } from "../../shared/types/error.js";
import { env } from "../../config/env.js";
import type { AuthResult, AppJwtPayload } from "../../shared/types/auth.js"
import { type IUser, type PublicUser } from "../../shared/types/user.type.js";

export async function register(username: string, email: string, password: string): Promise<PublicUser>{
    const hashpass = await bcrypt.hash(password, 10);
    const result = await pool.query(`
        INSERT INTO users(username, email, password)
        VALUES($1, $2, $3)
        RETURNING id, username, email
    `,[username, email, hashpass])
    const user = result.rows[0];
    if (!user){
        throw new AppError( "Some error with user registration", 401 );
    }
    return user;
}
export async function login(email: string, password: string): Promise<AuthResult>{
    const result = await pool.query<IUser>("SELECT id, username, email, password FROM users WHERE email = $1", [email]);
    const candidate = result.rows[0];
    if(!candidate){
        throw new AppError("Such user doesn't exist", 400);
    }
    const isPassEquals = await bcrypt.compare(password, candidate.password);
    if(!isPassEquals){
        throw new AppError("Pasword doesn't match", 400);
    }
    const payload: AppJwtPayload = {
        id: candidate.id.toString(),
        username: candidate.username,
        email: candidate.email,
    }
    const token = jwt.sign(
        payload,
        env.JWT_SECRET as string,
        { expiresIn: '1h' }
    )
    return {token, user: {
        id: candidate.id.toString(),
        username: candidate.username,
        email: candidate.email,
    }}
}