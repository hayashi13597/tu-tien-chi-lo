import { describe, it, expect } from 'vitest';
import { GetInventoryUseCase } from '../../src/application/GetInventoryUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', ...over };
}

describe('GetInventoryUseCase', () => {
  it('returns owned pills flattened with quantity', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    pills.seedPill(pill('b', { rarity: 2 }));
    pills.setQuantity('user-1', 'a', 3);
    pills.setQuantity('user-1', 'b', 1);
    const out = await new GetInventoryUseCase(pills).execute('user-1');
    const a = out.find((p) => p.id === 'a');
    expect(a).toMatchObject({ id: 'a', quantity: 3, effectKind: 'linhKhi', amount: 10 });
    expect(out.length).toBe(2);
  });

  it('returns an empty array for a user with no pills', async () => {
    const out = await new GetInventoryUseCase(new InMemoryPillRepository()).execute('nobody');
    expect(out).toEqual([]);
  });
});
