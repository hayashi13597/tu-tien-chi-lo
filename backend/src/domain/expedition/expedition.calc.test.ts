import { describe, expect, it } from 'vitest';
import { AttributeSet } from '../attributes/attributes';
import { ticketCostForDuration } from '../materials/material.calc';
import { CombatantSnapshot } from '../combat/combat';
import { SeededRandom } from '../combat/seeded-random';
import {
  enemyPowerFor,
  rewardMultiplier,
  rollExpeditionRewards,
  simulateExpedition,
  expeditionStartGate,
} from './expedition.calc';
import { ExpeditionBranchConfig, ExpeditionDifficultyConfig } from './expedition';

const branch: ExpeditionBranchConfig = {
  id: 'hoa-vuc', name: 'Hỏa Vực', glyph: '火', description: 'd', basePower: 10, alchemyMaterialId: 'xich-viem-tinh',
  upgradeMaterialWeights: [
    { materialId: 'linh-tai-khi-huyet', weight: 1 },
    { materialId: 'linh-tai-than-phap', weight: 2 },
    { materialId: 'linh-tai-hoa-luc', weight: 3 },
  ],
  tier: 1, minRealmMajor: 0, recommendedPower: 0, bossDropWeights: [],
};

const easy: ExpeditionDifficultyConfig = {
  key: 'easy', enemyMultiplier: 0.8, normalDropRate: 0.5, bossDropRate: 0.7, rewardMultiplier: 0.8, adaptiveCoefficient: 0.1,
};
const hard: ExpeditionDifficultyConfig = {
  key: 'hard', enemyMultiplier: 1.4, normalDropRate: 0.9, bossDropRate: 1, rewardMultiplier: 1.3, adaptiveCoefficient: 0.1,
};

const playerAttributes: AttributeSet = {
  khiHuyet: 1_000, chanNguyen: 100, congVatLy: 100, congPhep: 0, phongThu: 20, tocDo: 30,
};
const player: CombatantSnapshot = {
  id: 'player', attributes: playerAttributes, battlePower: 200, maxChanNguyen: 100, skills: [],
};

class ConstantRandom {
  constructor(private readonly value: number) {}
  next(): number { return this.value; }
}

describe('expedition calculations', () => {
  it('duration dùng ticket cost 1/2/4', () => {
    expect(ticketCostForDuration(1_800)).toBe(1);
    expect(ticketCostForDuration(7_200)).toBe(2);
    expect(ticketCostForDuration(28_800)).toBe(4);
  });

  it('enemy power adaptive bị clamp trong biên ±15%', () => {
    expect(enemyPowerFor({
      branchBasePower: 100,
      difficultyMultiplier: 1.5,
      realmMultiplier: 2,
      playerBattlePower: 10_000,
      realmReferencePower: 100,
      adaptiveCoefficient: 1,
    })).toBe(345);
    expect(enemyPowerFor({
      branchBasePower: 100,
      difficultyMultiplier: 1.5,
      realmMultiplier: 2,
      playerBattlePower: 1,
      realmReferencePower: 100,
      adaptiveCoefficient: 1,
    })).toBe(255);
  });

  it('difficulty cao tăng enemy power, drop rate và reward budget', () => {
    expect(enemyPowerFor({ branchBasePower: 100, difficultyMultiplier: hard.enemyMultiplier, realmMultiplier: 1, playerBattlePower: 100, realmReferencePower: 100, adaptiveCoefficient: 0 }))
      .toBeGreaterThan(enemyPowerFor({ branchBasePower: 100, difficultyMultiplier: easy.enemyMultiplier, realmMultiplier: 1, playerBattlePower: 100, realmReferencePower: 100, adaptiveCoefficient: 0 }));
    const easyReward = rollExpeditionRewards({ branch, difficulty: easy, ticketCostUnits: 2, wins: 2, random: new ConstantRandom(0.6) });
    const hardReward = rollExpeditionRewards({ branch, difficulty: hard, ticketCostUnits: 2, wins: 2, random: new ConstantRandom(0.6) });
    expect(hardReward.linhThach).toBeGreaterThan(easyReward.linhThach);
    const easyQuantity = easyReward.materials.reduce((sum, item) => sum + item.quantity, 0);
    const hardQuantity = hardReward.materials.reduce((sum, item) => sum + item.quantity, 0);
    expect(hardQuantity).toBeGreaterThan(easyQuantity);
  });

  it('reward multiplier theo số trận thắng là 25/50/75/100%', () => {
    expect(rewardMultiplier(0)).toBe(0.25);
    expect(rewardMultiplier(1)).toBe(0.5);
    expect(rewardMultiplier(2)).toBe(0.75);
    expect(rewardMultiplier(3)).toBe(1);
  });

  it('simulate đúng thứ tự 2 normal + 1 boss và seeded reward ổn định', () => {
    const first = simulateExpedition({ player, branch, difficulty: easy, realmMultiplier: 0.01, realmReferencePower: 200, ticketCostUnits: 1, random: new SeededRandom(42), maxTurns: 5 });
    const second = simulateExpedition({ player, branch, difficulty: easy, realmMultiplier: 0.01, realmReferencePower: 200, ticketCostUnits: 1, random: new SeededRandom(42), maxTurns: 5 });
    expect(first.encounters.map((encounter) => encounter.kind)).toEqual(['normal', 'normal', 'boss']);
    expect(first.wins).toBe(3);
    expect(first.reward).toEqual(second.reward);
    expect(branch.upgradeMaterialWeights).toHaveLength(3);
    expect(first.reward.materials.some((item) => item.materialId === branch.alchemyMaterialId)).toBe(true);
  });

  it('thua vẫn trả reward multiplier theo số trận thắng', () => {
    const result = simulateExpedition({ player: { ...player, battlePower: 1, attributes: { ...playerAttributes, khiHuyet: 10, congVatLy: 1 } }, branch: { ...branch, basePower: 10_000 }, difficulty: hard, realmMultiplier: 1, realmReferencePower: 1, ticketCostUnits: 4, random: new ConstantRandom(0.5), maxTurns: 1 });
    expect(result.wins).toBe(0);
    expect(result.reward.multiplier).toBe(0.25);
  });
});

describe('expeditionStartGate', () => {
  it('chặn khi realm thấp hơn gate, message mang tên cảnh giới', () => {
    expect(() => expeditionStartGate({ ...branch, tier: 2, minRealmMajor: 3 }, 2, 'Kết Đan'))
      .toThrowError(/Tầng 2 yêu cầu cảnh giới Kết Đan/);
  });
  it('qua khi đủ cảnh', () => {
    expect(() => expeditionStartGate({ ...branch, tier: 2, minRealmMajor: 3 }, 3, 'Kết Đan')).not.toThrow();
  });
  it('tầng 1 không gate (minRealmMajor 0)', () => {
    expect(() => expeditionStartGate(branch, 0, 'Phàm Nhân')).not.toThrow();
  });
});
