export type FundingStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface FundingRequest {
	id: number;
	amount: string;
	status: FundingStatus;
	reason: string | null;
	createdAt: string;
	reviewedAt: string | null;
}

export interface AdminFundingRequest extends FundingRequest {
	userId: number;
	username: string;
	email: string;
}

export interface FundingReviewed {
	request: FundingRequest;
}
