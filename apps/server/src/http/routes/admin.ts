import { Router, type Request, type Response } from "express";
import { VALID_ROOMS, type RoomName } from "@crypto-price-ws/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getUserDetail,
  getUserTrades,
  listUsers,
  userExists,
} from "../service/admin.service.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PG_INT = 2_147_483_647;
const MAX_SEARCH_LENGTH = 100;

const router = Router();
router.use(requireAuth, requireAdmin);

function parsePositiveInt(value: unknown, fallback?: number): number | null {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) return null;
    const n = Number(value);
    return n >= 1 && n <= MAX_PG_INT ? n : null;
}

router.get("/users", async (req: Request, res: Response) => {
    const page = parsePositiveInt(req.query.page, 1);
    const requestedSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE);
    if (page === null) return res.status(400).json({ error: "Invalid page" });
    if (requestedSize === null) return res.status(400).json({ error: "Invalid pageSize" });

    const raw = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const search = raw ? raw.slice(0, MAX_SEARCH_LENGTH) : undefined;

    try {
        const result = await listUsers({
            search,
            page,
            pageSize: Math.min(requestedSize, MAX_PAGE_SIZE),
        });
        return res.json(result);
    } catch (err) {
        console.error("admin:list users failed", err);
        return res.status(500).json({ error: "Failed to load users" });
    }
});

router.get("/users/:id", async (req: Request, res: Response) => {
    const id = parsePositiveInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid user id" });

    try {
        const detail = await getUserDetail(id);
        if (!detail) return res.status(404).json({ error: "User not found" });
        return res.json(detail);
    } catch (err) {
        console.error("admin:user detail failed", err);
        return res.status(500).json({ error: "Failed to load user" });
    }
});

router.get("/users/:id/trades", async (req: Request, res: Response) => {
    const id = parsePositiveInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid user id" });

    let token: RoomName | undefined;
    if (req.query.token !== undefined) {
        if (typeof req.query.token !== "string" || !VALID_ROOMS.has(req.query.token as RoomName)) {
            return res.status(400).json({ error: "Invalid token" });
        }
        token = req.query.token as RoomName;
    }

    try {
        if (!(await userExists(id))) return res.status(404).json({ error: "User not found" });
        return res.json(await getUserTrades(id, token));
    } catch (err) {
        console.error("admin:user trades failed", err);
        return res.status(500).json({ error: "Failed to load trades" });
    }
});

export default router;