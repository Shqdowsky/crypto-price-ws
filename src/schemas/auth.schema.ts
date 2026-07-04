import {z} from "zod";

export const registerSchema = z.object({
    username: z.string().min(2),
    email: z.string(),
    password: z.string().min(6),
})

export const loginSchema = z.object({
    email: z.string(),
    password: z.string().min(6),
})

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;