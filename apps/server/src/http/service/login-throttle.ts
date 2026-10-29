// Resets on server restart and isn't shared between server instances

const MAX_FAILURES = 5;
const BASE_LOCK_MS = 60_000;
const MAX_LOCK_MS = 60 * 60_000;
const FAILURE_WINDOW_MS = 60 * 60_000; // failures older than this stop counting
const FORGET_AFTER_MS = 60 * 60_000;
const MAX_ENTRIES = 10_000;

interface Entry {
	failures: number;
	lockCount: number;
	lockedUntil: number;
	lastActivity: number;
}

const entries = new Map<string, Entry>();

const keyOf = (email: string, ip: string) => `${email.trim().toLowerCase()}|${ip}`;

function store(key: string, entry: Entry): void {
	entries.delete(key);
	entries.set(key, entry);
	if (entries.size > MAX_ENTRIES) {
		const oldest = entries.keys().next().value;
		if (oldest !== undefined) entries.delete(oldest);
	}
}

export type LockStatus = { locked: false } | { locked: true; retryAfterMs: number };

export function checkLock(email: string, ip: string, now = Date.now()): LockStatus {
	const entry = entries.get(keyOf(email, ip));
	if (entry && entry.lockedUntil > now) {
		return { locked: true, retryAfterMs: entry.lockedUntil - now };
	}
	return { locked: false };
}

export interface FailureResult {
	locked: boolean;
	retryAfterMs: number;
	attemptsLeft: number;
}

export function recordFailure(email: string, ip: string, now = Date.now()): FailureResult {
	const key = keyOf(email, ip);
	const entry = entries.get(key) ?? {
		failures: 0,
		lockCount: 0,
		lockedUntil: 0,
		lastActivity: now,
	};

	if (entry.failures > 0 && now - entry.lastActivity > FAILURE_WINDOW_MS) entry.failures = 0;
	entry.lastActivity = now;
	entry.failures += 1;

	if (entry.failures >= MAX_FAILURES) {
		entry.lockCount += 1;
		const lockMs = Math.min(BASE_LOCK_MS * 2 ** (entry.lockCount - 1), MAX_LOCK_MS);
		entry.lockedUntil = now + lockMs;
		entry.failures = 0;
		store(key, entry);
		return { locked: true, retryAfterMs: lockMs, attemptsLeft: 0 };
	}

	store(key, entry);
	return { locked: false, retryAfterMs: 0, attemptsLeft: MAX_FAILURES - entry.failures };
}

export function recordSuccess(email: string, ip: string): void {
	entries.delete(keyOf(email, ip));
}

export function pruneLoginThrottle(now = Date.now()): void {
	for (const [key, entry] of entries) {
		if (now - Math.max(entry.lastActivity, entry.lockedUntil) > FORGET_AFTER_MS) {
			entries.delete(key);
		}
	}
}

export function resetLoginThrottle(): void {
	entries.clear();
}
