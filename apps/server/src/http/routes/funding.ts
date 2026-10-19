import { Router, type Request, type Response } from "express";
import type { PublicUser } from "@crypto-price-ws/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createFundingRequest,
  listMyFundingRequests,
  toFundingDTO,
  FundingError,
  type FundingErrorCode,
  cancelFundingRequest,
} from "../service/funding.service.js";

type AuthedRequest = Request & { user?: PublicUser };

const STATUS_BY_CODE: Record<FundingErrorCode, number> = {
  INVALID_AMOUNT: 400,
  REASON_REQUIRED: 400,
  NOT_FOUND: 404,
  SELF_APPROVAL: 403,
  REQUEST_PENDING: 409,
  ALREADY_REVIEWED: 409,
  INSUFFICIENT_TREASURY: 409,
};

export function sendFundingError(err: unknown, res: Response, what: string) {
  if (err instanceof FundingError) {
    return res.status(STATUS_BY_CODE[err.code]).json({ error: err.message, code: err.code });
  }
  console.error(`funding:${what} failed`, err);
  return res.status(500).json({ error: "Internal server error" });
}

const router = Router();
router.use(requireAuth);

router.post("/", async (req: AuthedRequest, res: Response) => {
  const amount: unknown = req.body?.amount;
  if (typeof amount !== "number") {
    return res.status(400).json({ error: "Amount must be a number", code: "INVALID_AMOUNT" });
  }
  try {
    const row = await createFundingRequest(req.user!.id, amount);
    return res.status(201).json({ request: toFundingDTO(row) });
  } catch (err) {
    return sendFundingError(err, res, "create");
  }
});

router.get("/mine", async (req: AuthedRequest, res: Response) => {
  try {
    return res.json({ requests: await listMyFundingRequests(req.user!.id) });
  } catch (err) {
    return sendFundingError(err, res, "list mine");
  }
});

router.post("/:id/cancel", async (req: AuthedRequest, res: Response) => {
  const idParam = String(req.params.id || "");

  const id = /^\d{1,10}$/.test(idParam) ? Number(idParam) : 0;
  if (id < 1) return res.status(400).json({ error: "Invalid request id" });
  try {
    const row = await cancelFundingRequest(req.user!.id, id);
    return res.json({ request: toFundingDTO(row) });
  } catch (err) {
    return sendFundingError(err, res, "cancel");
  }
});

export default router;
