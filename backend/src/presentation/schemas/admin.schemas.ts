import { z } from 'zod';

// Nested realm config for PUT /admin/realms. Nested arrays inherently give
// contiguous realm/sub indices; per-field ranges are enforced here, and the
// cross-cutting monotonic-linhKhi rule is enforced in UpdateRealmConfigUseCase.
const subStageSchema = z.object({
  name: z.string().min(1),
  linhKhiRequired: z.number().positive(),
  cultivationRate: z.number().positive(),
  baseSuccessRate: z.number().min(0).max(100),
  pityIncrement: z.number().min(0),
  maxSuccessRate: z.number().min(0).max(100),
  punishmentSeconds: z.number().int().min(0),
});

const realmSchema = z.object({
  name: z.string().min(1),
  subStages: z.array(subStageSchema).min(1),
});

export const updateRealmsSchema = z.object({
  realms: z.array(realmSchema).min(1),
});

export type UpdateRealmsInput = z.infer<typeof updateRealmsSchema>;
