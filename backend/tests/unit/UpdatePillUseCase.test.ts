import { describe, it, expect } from 'vitest';
import { UpdatePillUseCase } from '../../src/application/UpdatePillUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}

describe('UpdatePillUseCase', () => {
  it('updates an existing pill (including active toggle)', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    const saved = await new UpdatePillUseCase(pills).execute(pill('a', { name: 'Mới', active: false }));
    expect(saved.name).toBe('Mới');
    expect((await pills.findById('a'))?.active).toBe(false);
  });

  it('rejects an unknown id with PILL_NOT_FOUND', async () => {
    const pills = new InMemoryPillRepository();
    await expect(new UpdatePillUseCase(pills).execute(pill('ghost')))
      .rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
  });

  it('rejects an invalid definition with INVALID_PILL_CONFIG before writing', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    await expect(new UpdatePillUseCase(pills).execute(pill('a', { rarity: 9 })))
      .rejects.toMatchObject({ code: 'INVALID_PILL_CONFIG' });
    expect((await pills.findById('a'))?.rarity).toBe(0); // untouched
  });
});
