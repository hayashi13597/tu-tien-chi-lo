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

// Pill bodies for POST/PUT /admin/pills. Shape/type/range checks live here;
// the per-effectKind coherence rules (which stat fields must be set vs null)
// live in domain validatePillDefinition — zod can't express them cleanly.
const pillBodySchema = z.object({
  name: z.string().min(1),
  glyph: z.string().min(1),
  rarity: z.number().int().min(0).max(4),
  effectKind: z.enum(['linhKhi', 'cultivationBuff', 'breakthroughBoost', 'clearPunishment']),
  amount: z.number().nullable(),
  multiplier: z.number().nullable(),
  durationSec: z.number().int().nullable(),
  bonusPct: z.number().nullable(),
  desc: z.string().min(1),
  active: z.boolean(),
  starterQuantity: z.number().int().min(0),
});

// POST carries the id (kebab-case slug, immutable afterwards); PUT takes it
// from the URL, so the body schema deliberately has no id field.
export const createPillSchema = pillBodySchema.extend({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug (a-z, 0-9, -)'),
});
export const updatePillSchema = pillBodySchema;
