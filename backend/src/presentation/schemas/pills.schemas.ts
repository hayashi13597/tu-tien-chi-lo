import { z } from 'zod';

export const consumePillSchema = z.object({
  pillId: z.string().min(1),
});
