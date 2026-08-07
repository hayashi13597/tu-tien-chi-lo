import { describe, expect, it } from 'vitest';
import { AttributeSet } from '../attributes/attributes';
import { CombatantSnapshot } from './combat';
import { activeSkillPower, simulateBattle } from './combat.calc';
import { SeededRandom } from './seeded-random';

class SequenceRandom {
  private index = 0;
  constructor(private readonly values: number[]) {}
  next(): number {
    const value = this.values[this.index % this.values.length];
    this.index += 1;
    return value;
  }
}

const attrs = (overrides: Partial<AttributeSet> = {}): AttributeSet => ({
  khiHuyet: 100,
  chanNguyen: 100,
  congVatLy: 10,
  congPhep: 0,
  phongThu: 0,
  tocDo: 10,
  ...overrides,
});

function fighter(id: 'player' | 'enemy', overrides: Partial<CombatantSnapshot> = {}): CombatantSnapshot {
  return {
    id,
    attributes: attrs(),
    battlePower: 100,
    maxChanNguyen: 100,
    skills: [],
    ...overrides,
  };
}

describe('turn-based combat simulator', () => {
  it('combatant có tocDo cao hành động trước', () => {
    const result = simulateBattle({
      player: fighter('player', { attributes: attrs({ tocDo: 20 }) }),
      enemy: fighter('enemy', { attributes: attrs({ tocDo: 5 }) }),
      random: new SequenceRandom([0.1]),
      maxTurns: 1,
    });
    expect(result.turns[0].actor).toBe('player');
  });

  it('ưu tiên skill slot thấp nhất và thắng khi skill hạ enemy', () => {
    const result = simulateBattle({
      player: fighter('player', {
        skills: [
          { id: 'slot-1', power: 20, chanNguyenCost: 0, cooldownRounds: 0, slot: 1 },
          { id: 'slot-0', power: 100, chanNguyenCost: 0, cooldownRounds: 0, slot: 0 },
        ],
      }),
      enemy: fighter('enemy', { attributes: attrs({ khiHuyet: 50, tocDo: 1 }) }),
      random: new SequenceRandom([0.1]),
      maxTurns: 3,
    });
    expect(result.turns[0].actor).toBe('player');
    expect(result.turns[0].action).toBe('slot-0');
    expect(result.winner).toBe('player');
  });

  it('không đủ Chân Nguyên thì dùng basic attack', () => {
    const result = simulateBattle({
      player: fighter('player', {
        maxChanNguyen: 10,
        skills: [{ id: 'expensive', power: 100, chanNguyenCost: 30, cooldownRounds: 0, slot: 0 }],
      }),
      enemy: fighter('enemy', { attributes: attrs({ tocDo: 1 }) }),
      random: new SequenceRandom([0.1]),
      maxTurns: 1,
    });
    expect(result.turns[0].action).toBe('basic-attack');
  });

  it('cooldown 2 ngăn đúng hai round rồi cho dùng lại', () => {
    const result = simulateBattle({
      player: fighter('player', {
        skills: [{ id: 'cooldown-skill', power: 1, chanNguyenCost: 0, cooldownRounds: 2, slot: 0 }],
      }),
      enemy: fighter('enemy', { attributes: attrs({ khiHuyet: 1_000, tocDo: 1, congVatLy: 0 }) }),
      random: new SequenceRandom([0.1]),
      maxTurns: 4,
    });
    expect(result.turns.filter((turn) => turn.actor === 'player').map((turn) => turn.action))
      .toEqual(['cooldown-skill', 'basic-attack', 'basic-attack', 'cooldown-skill']);
  });

  it('bỏ qua slot trống và giữ kết quả deterministic theo seed', () => {
    const input = {
      player: fighter('player', { skills: [{ id: 'slot-2', power: 20, chanNguyenCost: 0, cooldownRounds: 0, slot: 2 }] }),
      enemy: fighter('enemy', { attributes: attrs({ tocDo: 1 }) }),
      maxTurns: 3,
    };
    const first = simulateBattle({ ...input, random: new SeededRandom(42) });
    const second = simulateBattle({ ...input, random: new SeededRandom(42) });
    expect(first.turns[0].action).toBe('slot-2');
    expect(first).toEqual(second);
  });

  it('active skill power = powerPerLevel × level', () => {
    expect(activeSkillPower(120, 3)).toBe(360);
  });
});

describe('simulateBattle với pillBuffs (Phase 3)', () => {
  const startBuff = (pillId: string, attr: 'congVatLy' | 'phongThu' | 'khiHuyet', pct: number) =>
    ({ pillId, combatAttribute: attr, combatTrigger: 'start' as const, pct });
  const lowBuff = (pillId: string, attr: 'khiHuyet', pct: number) =>
    ({ pillId, combatAttribute: attr, combatTrigger: 'lowHp30' as const, pct });

  it('trigger start: buff congVatLy áp ngay lượt 1, damage tăng tỉ lệ', () => {
    const player = fighter('player', { attributes: attrs({ congVatLy: 50, tocDo: 10 }) });
    const enemy = fighter('enemy', { attributes: attrs({ khiHuyet: 10_000, tocDo: 1 }) });
    const plain = simulateBattle({ player: { ...player, attributes: { ...player.attributes } }, enemy, random: new SequenceRandom([0.5]), maxTurns: 1 });
    const buffed = simulateBattle({ player: { ...player, attributes: { ...player.attributes } }, enemy: { ...enemy, attributes: { ...enemy.attributes } }, random: new SequenceRandom([0.5]), maxTurns: 1, pillBuffs: [startBuff('p1', 'congVatLy', 100)] });
    const dmg = (r: typeof plain) => r.turns.find((t) => t.actor === 'player')?.damage ?? 0;
    // variance 1.0 cả hai (random 0.5) → damage nhân đúng 2 khi công 50→100.
    expect(dmg(buffed)).toBe(dmg(plain) * 2);
  });

  it('trigger lowHp30: kích khi HP ≤ 30% max, một lần; khiHuyet tăng cả max lẫn current', () => {
    // player máu 100 (ngưỡng 30), enemy đánh trước ~40/hit → sau hit đầu HP 60>30, hit 2 HP 20≤30 → buff +100% khiHuyet → maxHp 200, hp 120; buff chỉ kích 1 lần nên giúp trụ thêm.
    const fragile = fighter('player', { attributes: attrs({ khiHuyet: 100, congVatLy: 1, tocDo: 1 }) });
    const strong = fighter('enemy', { attributes: attrs({ khiHuyet: 100_000, congVatLy: 41, phongThu: 0, tocDo: 50 }) });
    const result = simulateBattle({
      player: fragile, enemy: strong, random: new SequenceRandom([0.5]), maxTurns: 20,
      pillBuffs: [lowBuff('hp-pill', 'khiHuyet', 100)],
    });
    // Enemy 41 damage/hit (variance 1.0). Không buff: 100→59→18→0 chết round 3.
    // Có buff: hit 2 hạ còn 18 ≤ 30 → +100% khiHuyet (max 200, hp 118) → sống thêm
    // đúng 2 round (118→77→36→0): buff kích 1 lần, không tái kích.
    const plain = simulateBattle({ player: { ...fragile, attributes: { ...fragile.attributes } }, enemy: { ...strong, attributes: { ...strong.attributes } }, random: new SequenceRandom([0.5]), maxTurns: 20 });
    expect(plain.winner).toBe('enemy');
    expect(plain.rounds).toBe(3);
    expect(result.winner).toBe('enemy');
    expect(result.rounds).toBe(5);
  });

  it('lowHp30 không kích khi HP không chạm ngưỡng', () => {
    const tank = fighter('player', { attributes: attrs({ khiHuyet: 100_000, tocDo: 50 }) });
    const weak = fighter('enemy', { attributes: attrs({ congVatLy: 5, tocDo: 1 }) });
    const buffed = simulateBattle({ player: tank, enemy: weak, random: new SequenceRandom([0.5]), maxTurns: 3, pillBuffs: [lowBuff('hp-pill', 'khiHuyet', 100)] });
    const plain = simulateBattle({ player: { ...tank, attributes: { ...tank.attributes } }, enemy: { ...weak, attributes: { ...weak.attributes } }, random: new SequenceRandom([0.5]), maxTurns: 3 });
    expect(buffed.turns.map((t) => t.damage)).toEqual(plain.turns.map((t) => t.damage));
  });

  it('không mutate snapshot đầu vào (battle sau buff lại từ đầu)', () => {
    const player = fighter('player');
    simulateBattle({ player, enemy: fighter('enemy'), random: new SequenceRandom([0.5]), maxTurns: 2, pillBuffs: [startBuff('p1', 'congVatLy', 100)] });
    expect(player.attributes.congVatLy).toBe(10);
  });
});
