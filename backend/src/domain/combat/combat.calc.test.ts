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
