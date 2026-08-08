import { z } from 'zod';

export const startExpeditionSchema = z.object({
  branchId: z.string().regex(/^[a-z0-9-]+$/),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  durationSec: z.union([z.literal(1_800), z.literal(7_200), z.literal(28_800)]),
  // Phase 3 — loadout đan combat: tối đa 2 id khác nhau; domain validate kind/active.
  loadoutPillIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(2)
    .refine((ids) => new Set(ids).size === ids.length, 'loadoutPillIds must be distinct')
    .optional(),
});
