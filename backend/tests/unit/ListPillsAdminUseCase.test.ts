import { describe, it, expect } from 'vitest';
import { ListPillsAdminUseCase } from '../../src/application/ListPillsAdminUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}

describe('ListPillsAdminUseCase', () => {
  it('returns the full catalog including inactive pills', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    pills.seedPill(pill('b', { active: false }));
    const out = await new ListPillsAdminUseCase(pills).execute();
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
});
