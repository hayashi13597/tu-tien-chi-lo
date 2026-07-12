import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
