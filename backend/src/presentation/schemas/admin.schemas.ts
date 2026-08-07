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
  // Thuộc tính nền của sub-stage. Mặc định 0 để body của client cũ (chưa biết
  // 6 trường này) vẫn hợp lệ thay vì bị 400.
  baseKhiHuyet: z.number().min(0).default(0),
  baseChanNguyen: z.number().min(0).default(0),
  baseCongVatLy: z.number().min(0).default(0),
  baseCongPhep: z.number().min(0).default(0),
  basePhongThu: z.number().min(0).default(0),
  baseTocDo: z.number().min(0).default(0),
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
  // Default giữ hành vi cũ (tier 1) cho body admin chưa gửi field mới.
  tier: z.number().int().min(1).max(3).default(1),
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

// Công pháp bodies for POST/PUT /admin/congphap. Như pill: zod lo shape/range,
// còn bất biến theo category (passive cần effects, active cần powerPerLevel…)
// nằm ở domain validateCongPhapDefinition.
const passiveEffectSchema = z.object({
  // Hai key cuối là buff hệ thống Phase 2 (rule flat=0/pct>0 nằm ở domain validate).
  attribute: z.enum(['khiHuyet', 'chanNguyen', 'congVatLy', 'congPhep', 'phongThu', 'tocDo', 'linhKhiRate', 'danDaoSuccess']),
  flatPerLevel: z.number(),
  pctPerLevel: z.number(),
});

const congPhapBodySchema = z.object({
  name: z.string().min(1),
  glyph: z.string().min(1),
  rarity: z.number().int(),
  category: z.enum(['active', 'passive']),
  desc: z.string().min(1),
  active: z.boolean(),
  maxLevel: z.number().int().min(1),
  baseCost: z.number().int().min(0),
  costGrowth: z.number().min(1),
  effects: z.array(passiveEffectSchema).nullable(),
  powerPerLevel: z.number().nullable(),
  chanNguyenCost: z.number().nullable(),
  dupRefundLinhThach: z.number().int().min(0).nullable(),
  upgradeMaterialId: z.string().regex(/^[a-z0-9-]+$/).nullable().default(null),
  baseMaterialCost: z.number().int().min(0).default(0),
  materialCostGrowth: z.number().min(1).default(1),
  cooldownRounds: z.number().int().min(0).nullable().default(null),
  // Phase 2. Bất biến (tier>=2 => branch + biTich, key đặc biệt flat=0/pct>0) ở domain validate.
  tier: z.number().int().min(1).max(3).default(1),
  branch: z.enum(['tuLuyen', 'chienDao', 'danDao']).nullable().default(null),
  minRealmMajor: z.number().int().min(0).default(0),
  biTichMaterialId: z.string().regex(/^[a-z0-9-]+$/).nullable().default(null),
});

export const createCongPhapSchema = congPhapBodySchema.extend({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug (a-z, 0-9, -)'),
});
export const updateCongPhapSchema = congPhapBodySchema;

// GET /admin/users?q=&limit= — query params luôn là string, nên coerce số.
// Clamp thực sự nằm ở SearchUsersUseCase (một chỗ duy nhất).
export const searchUsersQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

export const grantSchema = z.object({
  userId: z.string().min(1),
  congPhapId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  linhThach: z.number().int().optional(),
});

const materialCatalogRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  glyph: z.string().min(1),
  rarity: z.number().int().min(0),
  tier: z.number().int().min(1).max(3).default(1),
  description: z.string().min(1),
  active: z.boolean(),
});
export const updateMaterialsSchema = z.object({ materials: z.array(materialCatalogRowSchema).min(1) });

const alchemyRecipeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  pillId: z.string().regex(/^[a-z0-9-]+$/),
  durationSec: z.number().int().positive(),
  linhThachCost: z.number().int().min(0),
  active: z.boolean(),
  // Default giữ hành vi cũ (tier 1, deterministic) cho payload admin chưa gửi field mới.
  tier: z.number().int().min(1).max(3).default(1),
  minAlchemyRank: z.number().int().min(1).default(1),
  baseSuccessPct: z.number().int().min(5).max(100).default(100),
  ingredients: z.array(z.object({ materialId: z.string().regex(/^[a-z0-9-]+$/), quantity: z.number().int().positive() })).min(1),
});
export const updateAlchemyRecipesSchema = z.object({ recipes: z.array(alchemyRecipeSchema).min(1) });

const expeditionDifficultySchema = z.object({
  key: z.enum(['easy', 'normal', 'hard']),
  enemyMultiplier: z.number().positive(),
  normalDropRate: z.number().min(0).max(1),
  bossDropRate: z.number().min(0).max(1),
  rewardMultiplier: z.number().positive(),
  adaptiveCoefficient: z.number().min(0),
});
const expeditionBranchSchema = z.object({
  branch: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), glyph: z.string().min(1), description: z.string().min(1),
    basePower: z.number().positive(), alchemyMaterialId: z.string().regex(/^[a-z0-9-]+$/),
    upgradeMaterialWeights: z.array(z.object({ materialId: z.string().regex(/^[a-z0-9-]+$/), weight: z.number().min(0) })).min(1),
  }),
  difficulties: z.array(expeditionDifficultySchema).min(1),
});
export const updateExpeditionConfigSchema = z.object({ branches: z.array(expeditionBranchSchema).min(1) });
