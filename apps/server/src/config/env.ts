import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string | number{
    const value = process.env[key];
    if(!value) throw new Error(`Missing required env variable: ${key}`);
    return value;
}

export const env = {
    DB_HOST: requireEnv("DB_HOST"),
    DB_PORT: requireEnv("DB_PORT"),
    DB_NAME: requireEnv("DB_NAME"),
    DB_USER: requireEnv("DB_USER"),
    DB_PASSWORD: requireEnv("DB_PASSWORD"),
    JWT_SECRET: requireEnv("JWT_SECRET"),
    WS_PORT: Number(requireEnv("WS_PORT")),
    CLIENT_URL: requireEnv("CLIENT_URL") as string,
    REFRESH_TOKEN_MAX_AGE: requireEnv("REFRESH_TOKEN_MAX_AGE"),
    ACCESS_TOKEN_MAX_AGE: requireEnv("ACCESS_TOKEN_MAX_AGE")
}