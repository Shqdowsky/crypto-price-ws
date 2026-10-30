import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
	CANDLE_INTERVALS,
	CANDLE_MAX_PAGE_SIZE,
	CANDLE_PAGE_SIZE,
	VALID_ROOMS,
	type CandleInterval,
	type RoomName,
} from "@crypto-price-ws/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { getCandles } from "../service/candles.service.js";

const paramsSchema = z.object({
	token: z.string().refine((t) => VALID_ROOMS.has(t as RoomName), "Unknown token"),
});

const querySchema = z
	.object({
		interval: z.coerce
			.number()
			.int()
			.refine((n) => (CANDLE_INTERVALS as readonly number[]).includes(n), "Invalid interval"),
		before: z.coerce.number().int().nonnegative().optional(),
		after: z.coerce.number().int().nonnegative().optional(),
		limit: z.coerce.number().int().min(1).max(CANDLE_MAX_PAGE_SIZE).default(CANDLE_PAGE_SIZE),
	})
	.refine((q) => q.before === undefined || q.after === undefined, {
		message: "before and after are mutually exclusive",
	});

const router = Router();
router.use(requireAuth);

router.get("/:token", async (req: Request, res: Response) => {
	const params = paramsSchema.safeParse(req.params);
	const query = querySchema.safeParse(req.query);
	if (!params.success || !query.success) {
		const issue = (params.success ? query.error : params.error)?.issues[0];
		return res.status(400).json({ error: issue?.message ?? "Invalid request" });
	}
	try {
		const page = await getCandles({
			token: params.data.token,
			...query.data,
			interval: query.data.interval as CandleInterval,
		});
		return res.json(page);
	} catch (err) {
		console.error("candles:get failed", err);
		return res.status(500).json({ error: "Internal server error" });
	}
});

export default router;
