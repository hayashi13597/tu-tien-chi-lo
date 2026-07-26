import { z } from 'zod';

const congPhapIdSchema = z.string().regex(/^[a-z0-9-]+$/);

export const equipSchema = z.object({
  congPhapId: congPhapIdSchema,
  slot: z.number().int().min(0).max(3),
});
export const unequipSchema = z.object({ congPhapId: congPhapIdSchema });
export const levelUpSchema = z.object({ congPhapId: congPhapIdSchema });
