import { z } from 'zod';

export const startExpeditionSchema = z.object({
  branchId: z.string().regex(/^[a-z0-9-]+$/),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  durationSec: z.union([z.literal(1_800), z.literal(7_200), z.literal(28_800)]),
});
