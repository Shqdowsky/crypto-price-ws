import type { PoolClient } from "pg";
import pool from "../../config/db.js"; // your pool import path

export type FundingErrorCode =
	| "INVALID_AMOUNT"
	| "REQUEST_PENDING"
	| "NOT_FOUND"
	| "ALREADY_REVIEWED"
	| "INSUFFICIENT_TREASURY"
	| "SELF_APPROVAL"
	| "REASON_REQUIRED";

export class FundingError extends Error {
	constructor(
		public code: FundingErrorCode,
		message: string,
	) {
		super(message);
	}
}

export const FUNDING_MIN = 1000;
export const FUNDING_MAX = 5000;
const REASON_MAX = 500;

export async function createFundingRequest(userId: number, amount: number) {
	if (!Number.isInteger(amount) || amount < FUNDING_MIN || amount > FUNDING_MAX) {
		throw new FundingError("INVALID_AMOUNT", `Amount must be ${FUNDING_MIN}-${FUNDING_MAX}`);
	}
	try {
		const { rows } = await pool.query(
			`INSERT INTO funding_requests (user_id, amount) VALUES ($1, $2) RETURNING *`,
			[userId, amount],
		);
		return rows[0];
	} catch (err) {
		if ((err as { code?: string }).code === "23505") {
			throw new FundingError("REQUEST_PENDING", "You already have a pending request");
		}
		throw err;
	}
}

async function lockPendingRequest(client: PoolClient, requestId: number) {
	const { rows } = await client.query(`SELECT * FROM funding_requests WHERE id = $1 FOR UPDATE`, [
		requestId,
	]);
	const request = rows[0];
	if (!request) throw new FundingError("NOT_FOUND", "Request not found");
	if (request.status !== "pending") {
		throw new FundingError("ALREADY_REVIEWED", "Request was already reviewed");
	}
	return request;
}

export async function approveFundingRequest(adminId: number, requestId: number) {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const request = await lockPendingRequest(client, requestId);
		if (request.user_id === adminId) {
			throw new FundingError("SELF_APPROVAL", "You cannot approve your own request");
		}

		const treasury = await client.query<{ balance: string }>(
			`UPDATE treasury SET balance = balance - $1 WHERE balance >= $1 RETURNING balance`,
			[request.amount],
		);
		if (!treasury.rows[0]) {
			throw new FundingError("INSUFFICIENT_TREASURY", "Treasury balance is too low");
		}

		const user = await client.query<{ balance: string }>(
			`UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
			[request.amount, request.user_id],
		);
		if (!user.rows[0]) {
			throw new FundingError("NOT_FOUND", "Can't find the user");
		}
		const updated = await client.query(
			`UPDATE funding_requests
                SET status = 'approved', reviewed_by = $1, reviewed_at = now()
                WHERE id = $2 RETURNING *`,
			[adminId, requestId],
		);
		await client.query("COMMIT");
		return {
			request: updated.rows[0] as FundingRequestRow,
			userBalance: user.rows[0].balance,
			treasuryBalance: treasury.rows[0].balance,
		};
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}

export async function rejectFundingRequest(adminId: number, requestId: number, reason: string) {
	const trimmed = reason.trim();
	if (trimmed.length === 0 || trimmed.length > REASON_MAX) {
		throw new FundingError("REASON_REQUIRED", `Reason is required (max ${REASON_MAX} chars)`);
	}
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await lockPendingRequest(client, requestId);
		const { rows } = await client.query(
			`UPDATE funding_requests
                SET status = 'rejected', reason = $1, reviewed_by = $2, reviewed_at = now()
                WHERE id = $3 RETURNING *`,
			[trimmed, adminId, requestId],
		);
		await client.query("COMMIT");
		return { request: rows[0] };
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}

import type { AdminFundingRequest, FundingRequest, FundingStatus } from "@crypto-price-ws/shared";

export interface FundingRequestRow {
	id: number;
	user_id: number;
	amount: string;
	status: FundingStatus;
	reason: string | null;
	reviewed_by: number | null;
	created_at: string | Date;
	reviewed_at: string | Date | null;
}

const LIST_LIMIT = 100;
const iso = (v: string | Date) => new Date(v).toISOString();

export function toFundingDTO(row: FundingRequestRow): FundingRequest {
	return {
		id: row.id,
		amount: row.amount,
		status: row.status,
		reason: row.reason,
		createdAt: iso(row.created_at),
		reviewedAt: row.reviewed_at ? iso(row.reviewed_at) : null,
	};
}

export async function listMyFundingRequests(userId: number): Promise<FundingRequest[]> {
	const { rows } = await pool.query<FundingRequestRow>(
		`SELECT * FROM funding_requests WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
		[userId, LIST_LIMIT],
	);
	return rows.map(toFundingDTO);
}

export async function listFundingRequests(status: FundingStatus): Promise<AdminFundingRequest[]> {
	const order = status === "pending" ? "ASC" : "DESC";
	const { rows } = await pool.query<FundingRequestRow & { username: string; email: string }>(
		`SELECT fr.*, u.username, u.email
        FROM funding_requests fr JOIN users u ON u.id = fr.user_id
        WHERE fr.status = $1
        ORDER BY fr.created_at ${order}, fr.id ${order} LIMIT $2`,
		[status, LIST_LIMIT],
	);
	return rows.map((r) => ({
		...toFundingDTO(r),
		userId: r.user_id,
		username: r.username,
		email: r.email,
	}));
}

export async function getTreasuryBalance(): Promise<string> {
	const { rows } = await pool.query<{ balance: string }>(`SELECT balance FROM treasury`);
	return rows[0]?.balance ?? "0.00";
}

export async function cancelFundingRequest(userId: number, requestId: number) {
	// One guarded UPDATE: it only matches the user's own request, and only while pending.
	const { rows } = await pool.query<FundingRequestRow>(
		`UPDATE funding_requests
            SET status = 'cancelled', reviewed_at = now()
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING *`,
		[requestId, userId],
	);
	if (rows[0]) return rows[0];

	// Nothing updated: find out why. Only the user's own rows are visible here,
	// so another user's request looks exactly like a missing one.
	const existing = await pool.query(
		`SELECT 1 FROM funding_requests WHERE id = $1 AND user_id = $2`,
		[requestId, userId],
	);
	if (existing.rowCount === 0) throw new FundingError("NOT_FOUND", "Request not found");
	throw new FundingError("ALREADY_REVIEWED", "Request is no longer pending");
}
