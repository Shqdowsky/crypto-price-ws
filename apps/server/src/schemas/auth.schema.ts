import { z } from "zod";

const BCRYPT_MAX_BYTES = 72;
const byteLength = (value: string) => new TextEncoder().encode(value).length;

const emailField = z
	.string()
	.trim()
	.toLowerCase()
	.max(254, "Email is too long")
	.pipe(z.email("Enter a valid email address"));

const usernameField = z
	.string()
	.trim()
	.min(3, "Username must be at least 3 characters")
	.max(30, "Username must be at most 30 characters")
	.regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscores and hyphens");

const newPasswordField = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.refine((value) => byteLength(value) <= BCRYPT_MAX_BYTES, {
		message: `Password must be at most ${BCRYPT_MAX_BYTES} bytes`,
	});

const existingPasswordField = z.string().min(8, "Password must be at least 8 characters").max(128);

export const registerSchema = z.object({
	username: usernameField,
	email: emailField,
	password: newPasswordField,
});

export const loginSchema = z.object({
	email: emailField,
	password: existingPasswordField,
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
