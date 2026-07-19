import { describe, it, expect } from 'vitest';
import { CreatePillUseCase } from '../../src/application/CreatePillUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';
import { DomainError } from '../../src/domain/errors';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}

describe('CreatePillUseCase', () => {
  it('creates a valid pill and returns it', async () => {
    const pills = new InMemoryPillRepository();
    const created = await new CreatePillUseCase(pills).execute(pill('new-dan'));
    expect(created.id).toBe('new-dan');
    expect(await pills.findById('new-dan')).not.toBeNull();
  });

  it('rejects a duplicate id with PILL_ID_TAKEN', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('dup'));
    await expect(new CreatePillUseCase(pills).execute(pill('dup')))
      .rejects.toMatchObject({ code: 'PILL_ID_TAKEN' });
  });

  it('rejects an invalid definition with INVALID_PILL_CONFIG and does not persist', async () => {
    const pills = new InMemoryPillRepository();
    await expect(new CreatePillUseCase(pills).execute(pill('bad', { amount: null })))
      .rejects.toBeInstanceOf(DomainError);
    expect(await pills.findById('bad')).toBeNull();
  });
});
