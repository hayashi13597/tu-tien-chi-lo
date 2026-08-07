import { AttributeSet } from '../attributes/attributes';
import { DomainError } from '../errors';
import { simulateBattle } from '../combat/combat.calc';
import { CombatantSnapshot } from '../combat/combat';
import { RandomSource } from '../ports/RandomSource';
import {
  ExpeditionBranchConfig,
  ExpeditionDifficultyConfig,
  ExpeditionEncounterResult,
  ExpeditionSimulation,
  RewardPayload,
  RewardRollInput,
} from './expedition';

export function gameDayFor(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function enemyPowerFor(input: {
  branchBasePower: number;
  difficultyMultiplier: number;
  realmMultiplier: number;
  playerBattlePower: number;
  realmReferencePower: number;
  adaptiveCoefficient: number;
}): number {
  if (input.realmReferencePower <= 0 || input.branchBasePower < 0 || input.difficultyMultiplier <= 0 || input.realmMultiplier <= 0) {
    throw new DomainError('INVALID_EXPEDITION_CONFIG', 'invalid expedition scaling configuration');
  }
  const adaptive = input.adaptiveCoefficient * (input.playerBattlePower - input.realmReferencePower) / input.realmReferencePower;
  const clamped = Math.min(0.15, Math.max(-0.15, adaptive));
  return Math.round(input.branchBasePower * input.difficultyMultiplier * input.realmMultiplier * (1 + clamped));
}

export function rewardMultiplier(wins: 0 | 1 | 2 | 3): 0.25 | 0.5 | 0.75 | 1 {
  switch (wins) {
    case 0: return 0.25;
    case 1: return 0.5;
    case 2: return 0.75;
    case 3: return 1;
  }
}

export function rollExpeditionRewards(input: RewardRollInput): RewardPayload {
  const multiplier = rewardMultiplier(input.wins);
  const materials = new Map<string, number>();
  const encounters = ['normal', 'normal', 'boss'] as const;

  for (const kind of encounters) {
    const chance = kind === 'boss' ? input.difficulty.bossDropRate : input.difficulty.normalDropRate;
    if (input.random.next() < chance) {
      addMaterial(materials, input.branch.alchemyMaterialId, Math.max(1, Math.round(input.ticketCostUnits * input.difficulty.rewardMultiplier)));
    }
    if (input.random.next() < chance) {
      const selected = weightedMaterial(input.branch.upgradeMaterialWeights, input.random.next());
      if (selected) addMaterial(materials, selected, 1);
    }
  }

  const linhThach = Math.max(0, Math.round(20 * input.ticketCostUnits * input.difficulty.rewardMultiplier * multiplier));
  return { multiplier, linhThach, materials: [...materials].map(([materialId, quantity]) => ({ materialId, quantity })) };
}

export function simulateExpedition(input: {
  player: CombatantSnapshot;
  branch: ExpeditionBranchConfig;
  difficulty: ExpeditionDifficultyConfig;
  realmMultiplier: number;
  realmReferencePower: number;
  ticketCostUnits: 1 | 2 | 4;
  random: RandomSource;
  maxTurns: number;
}): ExpeditionSimulation {
  const encounters: ExpeditionEncounterResult[] = [];
  let wins = 0;
  for (const kind of ['normal', 'normal', 'boss'] as const) {
    const power = enemyPowerFor({
      branchBasePower: input.branch.basePower,
      difficultyMultiplier: input.difficulty.enemyMultiplier,
      realmMultiplier: input.realmMultiplier,
      playerBattlePower: input.player.battlePower,
      realmReferencePower: input.realmReferencePower,
      adaptiveCoefficient: input.difficulty.adaptiveCoefficient,
    });
    const battle = simulateBattle({
      player: input.player,
      enemy: enemyForPower(power, input.player.attributes.tocDo),
      random: input.random,
      maxTurns: input.maxTurns,
    });
    encounters.push({ kind, result: battle });
    if (battle.winner !== 'player') break;
    wins += 1;
  }
  return {
    encounters,
    wins: wins as 0 | 1 | 2 | 3,
    reward: rollExpeditionRewards({ ...input, wins: wins as 0 | 1 | 2 | 3 }),
  };
}

function addMaterial(materials: Map<string, number>, materialId: string, quantity: number): void {
  materials.set(materialId, (materials.get(materialId) ?? 0) + quantity);
}

function weightedMaterial(weights: readonly { materialId: string; weight: number }[], roll: number): string | null {
  const total = weights.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;
  let cursor = Math.min(1, Math.max(0, roll)) * total;
  for (const entry of weights) {
    cursor -= Math.max(0, entry.weight);
    if (cursor < 0) return entry.materialId;
  }
  return weights.at(-1)?.materialId ?? null;
}

function enemyForPower(power: number, playerSpeed: number): CombatantSnapshot {
  const attributes: AttributeSet = {
    khiHuyet: Math.max(1, power * 2),
    chanNguyen: 0,
    congVatLy: Math.max(1, power / 10),
    congPhep: 0,
    phongThu: Math.max(0, power / 20),
    tocDo: Math.max(1, playerSpeed - 1),
  };
  return { id: 'enemy', attributes, battlePower: power, maxChanNguyen: 0, skills: [] };
}

// Phase 3 — hard gate cảnh giới theo tầng (chiến lực recommendedPower chỉ là
// cảnh báo phía FE, server không chặn). realmName đã resolve ở application
// layer để domain không phụ thuộc realm catalog.
export function expeditionStartGate(
  branch: Pick<ExpeditionBranchConfig, 'tier' | 'minRealmMajor'>,
  realmMajor: number,
  realmName: string,
): void {
  if (realmMajor < branch.minRealmMajor) {
    throw new DomainError('EXPEDITION_REALM_GATE', `Tầng ${branch.tier} yêu cầu cảnh giới ${realmName}`);
  }
}
