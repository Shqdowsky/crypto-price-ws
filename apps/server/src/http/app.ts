import express from "express";
import http from "http";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import fundingRoutes from "./routes/funding.js";
import candleRoutes from "./routes/candles.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "../config/env.js";
import path from "node:path";

// Same relative depth from src/http (tsx) and dist/http (compiled), both land in apps/.
// import.meta.dirname because `__dirname` does not exist in ESM.
const clientDist = path.join(import.meta.dirname, "../../../client/dist");
const indexHtml = path.join(clientDist, "index.html");

const app = express();

// Heroku's router is one proxy hop. Without this req.ip is the router's address for every
// user, so the login throttle in auth.ts would lock out everyone together.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(
	cors({
		origin: env.CLIENT_URL,
		credentials: true,
	}),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.static(clientDist));

// SPA fallback. It must sit before the API routers: client routes /admin and
// /admin/users/:id share their URLs with API routes, so a page reload would otherwise get
// JSON. Browser navigations ask for html; fetch() sends Accept: */*, which resolves to json
// here, as do supertest requests with no Accept header.
app.use((req, res, next) => {
	if (req.method !== "GET" || req.accepts(["json", "html"]) !== "html") return next();
	res.sendFile(indexHtml, (err) => {
		if (err) next();
	});
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/funding-requests", fundingRoutes);
app.use("/candles", candleRoutes);

const httpserver = http.createServer(app);

export default httpserver;
