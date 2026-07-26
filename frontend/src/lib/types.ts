// The 6 character attributes. Keys are used verbatim by the backend
// (domain/attributes/attributes.ts) — do not localize them here.
export type AttributeKey =
  | "khiHuyet"
  | "chanNguyen"
  | "congVatLy"
  | "congPhep"
  | "phongThu"
  | "tocDo";

export type AttributeSet = Record<AttributeKey, number>;

export interface CultivationState {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  linhKhi: number;
  linhKhiRequired: number;
  canBreakthrough: boolean;
  isMaxStage: boolean;
  punishedUntil: string | null;
  cultivationRate: number;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: string | null; // ISO 8601
  breakthroughBonusPct: number;
  /** Success chance (%) the next breakthrough would use: base + pity + boost. */
  breakthroughSuccessRate: number;
  /** Currency for levelling công pháp (redeem codes + admin grants). */
  linhThach: number;
  /** `base` = realm stage floor; `final` = after passive công pháp bonuses. */
  attributes: { base: AttributeSet; final: AttributeSet };
  /** Weighted sum of the final attributes; active công pháp do not count. */
  battlePower: number;
}

export interface Me {
  id: string;
  username: string;
  role: string;
}

export interface RealmDistributionEntry {
  realmMajor: number;
  realmName: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  realmDistribution: RealmDistributionEntry[];
  punishedCount: number;
}

export interface SubStageConfigDTO {
  name: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
  // Attribute floor for this sub-stage, before passive công pháp bonuses.
  baseKhiHuyet: number;
  baseChanNguyen: number;
  baseCongVatLy: number;
  baseCongPhep: number;
  basePhongThu: number;
  baseTocDo: number;
}

export interface RealmConfigDTO {
  name: string;
  subStages: SubStageConfigDTO[];
}

export interface BreakthroughResult {
  success: boolean;
  character: {
    id: string;
    userId: string;
    realmMajor: number;
    realmSub: number;
    linhKhi: number;
    lastUpdateAt: string;
    breakthroughFails: number;
    punishedUntil: string | null;
    createdAt: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ToastItem {
  id: number;
  title: string;
  message: string;
  type: "success" | "danger" | "purple" | "info";
}

export type PillRarity = 0 | 1 | 2 | 3 | 4;

export type PillEffectKind =
  | "linhKhi"
  | "cultivationBuff"
  | "breakthroughBoost"
  | "clearPunishment";

// Flat inventory item as returned by GET /pills/inventory (backend InventoryDto).
export interface PillInventoryItem {
  id: string;
  name: string;
  glyph: string;
  rarity: PillRarity;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
  quantity: number;
}

// Full pill definition as the admin catalog editor sees it (GET/POST/PUT
// /admin/pills). Unlike PillInventoryItem, this carries the admin-only
// fields: active (soft-disable) and starterQuantity (new-player grant).
export interface AdminPillDTO {
  id: string;
  name: string;
  glyph: string;
  rarity: PillRarity;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
  active: boolean;
  starterQuantity: number;
}

export type RedeemRewardKind = "pill" | "congphap" | "linhThach";

export interface RedeemRewardDTO {
  kind: RedeemRewardKind;
  /** pillId / congPhapId / the literal "linh-thach". */
  id: string;
  name: string;
  glyph: string;
  quantity: number;
}

export interface RedeemResult {
  rewards: RedeemRewardDTO[];
}

// A code reward carries exactly one of pillId / congPhapId / linhThach; the
// backend rejects zero or two kinds (validateRedeemCodeDefinition).
export interface AdminRedeemRewardDTO {
  pillId?: string;
  congPhapId?: string;
  linhThach?: number;
  quantity: number;
}

export interface AdminRedeemCodeDTO {
  id: string;
  code: string;
  active: boolean;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: string | null; // ISO 8601 or null
  rewards: AdminRedeemRewardDTO[];
}

export type CongPhapCategory = "active" | "passive";

export interface PassiveEffectDTO {
  attribute: AttributeKey;
  flatPerLevel: number;
  pctPerLevel: number;
}

// A công pháp definition (GET /congphap catalog, and the admin catalog).
// `rarity` is a plain Int on the backend — not bounded to 0–4 like pills —
// so presentation must clamp it (see getCongPhapRarityMeta).
export interface CongPhapDTO {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  category: CongPhapCategory;
  desc: string;
  active: boolean;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  upgradeMaterialId: string | null;
  baseMaterialCost: number;
  materialCostGrowth: number;
  /** Passive only: ≥1 entry. Null for active công pháp. */
  effects: PassiveEffectDTO[] | null;
  /** Active only: skill power = powerPerLevel × level (stored, not yet applied). */
  powerPerLevel: number | null;
  chanNguyenCost: number | null;
  dupRefundLinhThach: number | null;
}

export interface OwnedCongPhapDTO {
  def: CongPhapDTO;
  level: number;
  /** 0..3 when an active công pháp is equipped; null otherwise. */
  equippedSlot: number | null;
}

export interface CongPhapListResult {
  /** Owned entries keep inactive definitions so the UI can flag them. */
  owned: OwnedCongPhapDTO[];
  /** Catalog is active-only. */
  catalog: CongPhapDTO[];
}

export interface LevelUpResult {
  level: number;
  linhThach: number;
  material: { id: string; quantity: number } | null;
}

export interface AdminUserDTO {
  id: string;
  username: string;
  role: string;
  realmMajor: number;
  realmSub: number;
  linhThach: number;
}

export interface MaterialDTO {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  description: string;
  active: boolean;
}

export interface MaterialInventoryDTO {
  materialId: string;
  quantity: number;
  material?: MaterialDTO;
}

export interface AlchemyIngredientDTO {
  materialId: string;
  quantity: number;
}

export interface AlchemyRecipeDTO {
  id: string;
  pillId: string;
  durationSec: number;
  linhThachCost: number;
  active: boolean;
  ingredients: AlchemyIngredientDTO[];
}

export type AlchemyJobStatus = "queued" | "running" | "completed";

export interface AlchemyJobDTO {
  id: string;
  userId: string;
  characterId: string;
  recipeId: string;
  quantity: number;
  queuedAt: string;
  startsAt: string;
  completesAt: string;
  completedAt: string | null;
  outputGrantedAt: string | null;
  status: AlchemyJobStatus;
}

export interface AlchemyOutputGrantDTO {
  pillId: string;
  quantity: number;
}

export interface AlchemyQueueDTO {
  jobs: AlchemyJobDTO[];
  outputGrants: AlchemyOutputGrantDTO[];
}

export type ExpeditionDurationSec = 1800 | 7200 | 28800;
export type ExpeditionDifficultyKey = "easy" | "normal" | "hard";
export type ExpeditionStatus = "running" | "completed" | "claimed";
export type ExpeditionWins = 0 | 1 | 2 | 3;

export interface ExpeditionUpgradeMaterialWeightDTO {
  materialId: string;
  weight: number;
}

export interface ExpeditionBranchConfigDTO {
  id: string;
  name: string;
  glyph: string;
  description: string;
  basePower: number;
  alchemyMaterialId: string;
  upgradeMaterialWeights: ExpeditionUpgradeMaterialWeightDTO[];
}

export interface ExpeditionDifficultyDTO {
  key: ExpeditionDifficultyKey;
  enemyMultiplier: number;
  normalDropRate: number;
  bossDropRate: number;
  rewardMultiplier: number;
  adaptiveCoefficient: number;
}

export interface ExpeditionBranchDTO {
  branch: ExpeditionBranchConfigDTO;
  difficulties: ExpeditionDifficultyDTO[];
}

export interface ExpeditionRewardMaterialDTO {
  materialId: string;
  quantity: number;
}

export interface ExpeditionRewardDTO {
  multiplier: number;
  linhThach: number;
  materials: ExpeditionRewardMaterialDTO[];
}

export interface CombatSkillDTO {
  id: string;
  power: number;
  chanNguyenCost: number;
  cooldownRounds: number;
  slot: number;
}

export interface CombatantSnapshotDTO {
  id: "player" | "enemy";
  attributes: AttributeSet;
  battlePower: number;
  maxChanNguyen: number;
  skills: CombatSkillDTO[];
}

export interface CombatTurnDTO {
  round: number;
  actor: "player" | "enemy";
  target: "player" | "enemy";
  action: string;
  damage: number;
  remainingHp: number;
}

export interface BattleResultDTO {
  winner: "player" | "enemy" | "draw";
  turns: CombatTurnDTO[];
  rounds: number;
  playerRemainingHp: number;
  enemyRemainingHp: number;
}

export interface ExpeditionSimulationDTO {
  encounters: { kind: "normal" | "boss"; result: BattleResultDTO }[];
  wins: ExpeditionWins;
  reward: ExpeditionRewardDTO;
}

export interface ExpeditionCombatSnapshotDTO {
  player: CombatantSnapshotDTO;
  realmMajor: number;
  realmSub: number;
  realmMultiplier: number;
  realmReferencePower: number;
}

export interface ExpeditionDTO {
  id: string;
  userId: string;
  branchId: string;
  difficulty: ExpeditionDifficultyKey;
  durationSec: ExpeditionDurationSec;
  ticketCostUnits: 1 | 2 | 4;
  startedAt: string;
  completesAt: string;
  status: ExpeditionStatus;
  seed: number;
  combatSnapshot: ExpeditionCombatSnapshotDTO;
  combatResult: ExpeditionSimulationDTO;
  rewardResult: ExpeditionRewardDTO;
  claimedAt: string | null;
}

export interface CurrentExpeditionDTO {
  expedition: ExpeditionDTO | null;
  gameDay: string;
  spentUnits: number;
  remainingUnits: number;
}

export interface ExpeditionClaimDTO {
  expedition: ExpeditionDTO;
  reward: ExpeditionRewardDTO;
}

export interface StartExpeditionInput {
  branchId: string;
  difficulty: ExpeditionDifficultyKey;
  durationSec: ExpeditionDurationSec;
}
