import { Router, type Request, type Response } from "express";
import {
  VALID_ROOMS,
  type FundingStatus,
  type PublicUser,
  type RoomName,
} from "@crypto-price-ws/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getUserDetail, getUserTrades, listUsers, userExists } from "../service/admin.service.js";
import {
  approveFundingRequest,
  getTreasuryBalance,
  listFundingRequests,
  rejectFundingRequest,
  toFundingDTO,
} from "../service/funding.service.js";
import { sendFundingError } from "./funding.js";
import { notifyFundingReviewed } from "../../socket/notifier.js";

type AuthedRequest = Request & { user?: PublicUser };

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

router.get("/users", async (req: AuthedRequest, res: Response) => {
  const page = parsePositiveInt(req.query.page, 1);
  const adminId = req.user!.id;
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
      adminId,
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

const FUNDING_STATUSES = new Set<FundingStatus>(["pending", "approved", "rejected", "cancelled"]);

router.get("/treasury", async (_req: Request, res: Response) => {
  try {
    return res.json({ balance: await getTreasuryBalance() });
  } catch (err) {
    return sendFundingError(err, res, "treasury");
  }
});

router.get("/funding-requests", async (req: Request, res: Response) => {
  const status = req.query.status ?? "pending";
  if (typeof status !== "string" || !FUNDING_STATUSES.has(status as FundingStatus)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    return res.json({ requests: await listFundingRequests(status as FundingStatus) });
  } catch (err) {
    return sendFundingError(err, res, "list");
  }
});

router.post("/funding-requests/:id/approve", async (req: AuthedRequest, res: Response) => {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid request id" });
  try {
    const { request, userBalance, treasuryBalance } = await approveFundingRequest(req.user!.id, id);
    const dto = toFundingDTO(request);
    notifyFundingReviewed(request.user_id, dto, userBalance);
    return res.json({ request: dto, treasuryBalance });
  } catch (err) {
    return sendFundingError(err, res, "approve");
  }
});

router.post("/funding-requests/:id/reject", async (req: AuthedRequest, res: Response) => {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid request id" });
  const reason: unknown = req.body?.reason;
  if (typeof reason !== "string") {
    return res.status(400).json({ error: "Reason is required", code: "REASON_REQUIRED" });
  }
  try {
    const { request } = await rejectFundingRequest(req.user!.id, id, reason);
    const dto = toFundingDTO(request);
    notifyFundingReviewed(request.user_id, dto);
    return res.json({ request: dto });
  } catch (err) {
    return sendFundingError(err, res, "reject");
  }
});

export default router;
