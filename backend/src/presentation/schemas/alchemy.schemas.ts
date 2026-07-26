import { z } from 'zod';

export const queueAlchemySchema = z.object({
  recipeId: z.string().regex(/^[a-z0-9-]+$/),
  quantity: z.number().int().min(1).max(1000),
});
