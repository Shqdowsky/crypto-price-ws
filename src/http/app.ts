import express from "express";
import http from "http";
import authRoutes from "./routes/auth.js"

const app = express();

app.use(express.json());
app.use("/auth", authRoutes);

const httpserver = http.createServer(app);

export default httpserver;