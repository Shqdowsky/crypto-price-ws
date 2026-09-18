import express from "express";
import http from "http";
import authRoutes from "./routes/auth.js";
import cookieParser from "cookie-parser";
import cors from "cors"
import { env } from "../config/env.js";

const app = express();

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use("/auth", authRoutes);

const httpserver = http.createServer(app);

export default httpserver;