import { z } from 'zod';

export const redeemCodeSchema = z.object({
  code: z.string().min(1),
});

// Một reward là ĐÚNG MỘT trong ba loại. zod chỉ nới shape (cả ba optional);
// bất biến "đúng một loại" + chống trùng đã nằm ở domain
// validateRedeemCodeDefinition — không nhân đôi rule ở đây.
const rewardSchema = z.object({
  pillId: z.string().min(1).optional(),
  congPhapId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  linhThach: z.number().int().min(1).optional(),
  // Loại thứ tư (Phase 2): material (vd: bi-tich-*).
  materialId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  quantity: z.number().int().min(1),
});

const redeemCodeBodySchema = z.object({
  active: z.boolean(),
  maxRedemptions: z.number().int().min(1),
  expiresAt: z.string().datetime().nullable(),
  rewards: z.array(rewardSchema).min(1),
});

// POST carries the id (kebab-case slug, immutable afterwards).
export const createRedeemCodeSchema = redeemCodeBodySchema.extend({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug'),
  code: z.string().min(1),
});

// PUT takes id from the URL; body has no id or code (both immutable).
export const updateRedeemCodeSchema = redeemCodeBodySchema;
