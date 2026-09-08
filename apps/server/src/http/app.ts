import express from "express";
import http from "http";
import authRoutes from "./routes/auth.js";
import cookieParser from "cookie-parser";
import cors from "cors"
import { env } from "../config/env.js";

const app = express();

app.use(cors({
  origin: env.CLIENT_URL, // e.g. "http://localhost:3000" — NOT "*"
  credentials: true,
}));
app.use(express.json());
app.use("/auth", authRoutes);
app.use(cookieParser());

const httpserver = http.createServer(app);

export default httpserver;