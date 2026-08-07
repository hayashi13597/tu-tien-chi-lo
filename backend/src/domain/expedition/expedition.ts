import { CombatantSnapshot, BattleResult } from '../combat/combat';
import { AttributeSet } from '../attributes/attributes';
import { RandomSource } from '../ports/RandomSource';

export type ExpeditionDuration = 1_800 | 7_200 | 28_800;
export type ExpeditionDifficultyKey = 'easy' | 'normal' | 'hard';
export type ExpeditionStatus = 'running' | 'completed' | 'claimed';

// Phase 3 — đan combatBuff mang vào bí cảnh (tối đa 2 slot).
export type CombatBuffTrigger = 'start' | 'lowHp30';

export interface LoadoutEntry {
  pillId: string;
  combatAttribute: keyof AttributeSet;
  combatTrigger: CombatBuffTrigger;
  pct: number; // từ Pill.bonusPct
}

export interface ExpeditionUpgradeMaterialWeight {
  materialId: string;
  weight: number;
}

export interface ExpeditionBranchConfig {
  id: string;
  name: string;
  glyph: string;
  description: string;
  basePower: number;
  alchemyMaterialId: string;
  upgradeMaterialWeights: ExpeditionUpgradeMaterialWeight[];
  // Phase 3 — tầng 1..3 (Phàm/Linh/Thiên); gate cảnh giới hard, chiến lực soft.
  tier: number;
  minRealmMajor: number;
  recommendedPower: number;
  bossDropWeights: ExpeditionUpgradeMaterialWeight[]; // chỉ boss encounter roll
}

export interface ExpeditionDifficultyConfig {
  key: ExpeditionDifficultyKey;
  enemyMultiplier: number;
  normalDropRate: number;
  bossDropRate: number;
  rewardMultiplier: number;
  adaptiveCoefficient: number;
}

export interface ExpeditionEncounterResult {
  kind: 'normal' | 'boss';
  result: BattleResult;
}

export interface ExpeditionRewardMaterial {
  materialId: string;
  quantity: number;
}

export interface RewardPayload {
  multiplier: 0.25 | 0.5 | 0.75 | 1;
  linhThach: number;
  materials: ExpeditionRewardMaterial[];
}

export interface RewardRollInput {
  branch: ExpeditionBranchConfig;
  difficulty: ExpeditionDifficultyConfig;
  ticketCostUnits: 1 | 2 | 4;
  wins: 0 | 1 | 2 | 3;
  random: RandomSource;
}

export interface ExpeditionSimulation {
  encounters: ExpeditionEncounterResult[];
  wins: 0 | 1 | 2 | 3;
  reward: RewardPayload;
}

export interface ExpeditionCombatSnapshot {
  player: CombatantSnapshot;
  realmMajor: number;
  realmSub: number;
  realmMultiplier: number;
  realmReferencePower: number;
  loadout?: LoadoutEntry[];
}

export interface ExpeditionRecord {
  id: string;
  userId: string;
  branchId: string;
  difficulty: ExpeditionDifficultyKey;
  durationSec: ExpeditionDuration;
  ticketCostUnits: 1 | 2 | 4;
  startedAt: Date;
  completesAt: Date;
  status: ExpeditionStatus;
  seed: number;
  combatSnapshot: ExpeditionCombatSnapshot;
  combatResult: ExpeditionSimulation;
  rewardResult: RewardPayload;
  claimedAt: Date | null;
}

export interface CurrentExpeditionOutput {
  expedition: ExpeditionRecord | null;
  gameDay: string;
  spentUnits: number;
  remainingUnits: number;
}

export interface ClaimExpeditionOutput {
  expedition: ExpeditionRecord;
  reward: RewardPayload;
}
