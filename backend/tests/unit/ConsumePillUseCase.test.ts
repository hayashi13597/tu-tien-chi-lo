import { describe, it, expect } from 'vitest';
import { ConsumePillUseCase } from '../../src/application/ConsumePillUseCase';
import { InMemoryCharacterRepository } from '../fakes/InMemoryCharacterRepository';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { StaticRealmConfigSource } from '../fakes/StaticRealmConfigSource';
import { CharacterRecord } from '../../src/domain/entities/Character';
import { PillRecord } from '../../src/domain/pills/pill';

function makeCharacter(over: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-1', userId: 'user-1', realmMajor: 0, realmSub: 0, linhKhi: 0,
    lastUpdateAt: new Date(), breakthroughFails: 0, punishedUntil: null, createdAt: new Date(),
    cultivationBuffMultiplier: null, cultivationBuffUntil: null, breakthroughBonusPct: 0, ...over,
  };
}
function pill(id: string, over: Partial<PillRecord>): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: null, multiplier: null, durationSec: null, bonusPct: null, desc: '', ...over };
}
function setup(charOver: Partial<CharacterRecord> = {}) {
  const characters = new InMemoryCharacterRepository();
  characters.seed(makeCharacter(charOver));
  const pills = new InMemoryPillRepository();
  return { characters, pills, useCase: new ConsumePillUseCase(characters, pills, new StaticRealmConfigSource()) };
}

describe('ConsumePillUseCase', () => {
  it('linhKhi pill adds linh khi and decrements inventory', async () => {
    const { characters, pills, useCase } = setup({ linhKhi: 10 });
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 2);

    const state = await useCase.execute('user-1', 'a');
    expect(state.linhKhi).toBeGreaterThanOrEqual(110);
    const saved = await characters.findByUserId('user-1');
    expect(saved?.linhKhi).toBeGreaterThanOrEqual(110);
    const inv = await pills.listInventory('user-1');
    expect(inv.find((e) => e.pill.id === 'a')?.quantity).toBe(1);
  });

  it('cultivationBuff pill sets buff multiplier and expiry', async () => {
    const { characters, pills, useCase } = setup();
    pills.seedPill(pill('b', { effectKind: 'cultivationBuff', multiplier: 2, durationSec: 60 }));
    pills.setQuantity('user-1', 'b', 1);
    await useCase.execute('user-1', 'b');
    const saved = await characters.findByUserId('user-1');
    expect(saved?.cultivationBuffMultiplier).toBe(2);
    expect(saved?.cultivationBuffUntil).not.toBeNull();
  });

  it('breakthroughBoost pill sets breakthroughBonusPct', async () => {
    const { characters, pills, useCase } = setup();
    pills.seedPill(pill('c', { effectKind: 'breakthroughBoost', bonusPct: 15 }));
    pills.setQuantity('user-1', 'c', 1);
    await useCase.execute('user-1', 'c');
    const saved = await characters.findByUserId('user-1');
    expect(saved?.breakthroughBonusPct).toBe(15);
  });

  it('clearPunishment pill clears punishedUntil', async () => {
    const { characters, pills, useCase } = setup({ punishedUntil: new Date(Date.now() + 60_000) });
    pills.seedPill(pill('d', { effectKind: 'clearPunishment' }));
    pills.setQuantity('user-1', 'd', 1);
    await useCase.execute('user-1', 'd');
    const saved = await characters.findByUserId('user-1');
    expect(saved?.punishedUntil).toBeNull();
  });

  it('rejects clearPunishment when not punished (PILL_NOT_APPLICABLE)', async () => {
    const { pills, useCase } = setup({ punishedUntil: null });
    pills.seedPill(pill('d', { effectKind: 'clearPunishment' }));
    pills.setQuantity('user-1', 'd', 1);
    await expect(useCase.execute('user-1', 'd')).rejects.toMatchObject({ code: 'PILL_NOT_APPLICABLE' });
  });

  it('rejects linhKhi/boost at max stage (PILL_NOT_APPLICABLE)', async () => {
    const { pills, useCase } = setup({ realmMajor: 11, realmSub: 4 });
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 1);
    await expect(useCase.execute('user-1', 'a')).rejects.toMatchObject({ code: 'PILL_NOT_APPLICABLE' });
  });

  it('rejects an unknown pill (PILL_NOT_FOUND)', async () => {
    const { useCase } = setup();
    await expect(useCase.execute('user-1', 'nope')).rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
  });

  it('rejects when out of stock (PILL_OUT_OF_STOCK)', async () => {
    const { pills, useCase } = setup();
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 0);
    await expect(useCase.execute('user-1', 'a')).rejects.toMatchObject({ code: 'PILL_OUT_OF_STOCK' });
  });

  it('rejects an unknown user (CHARACTER_NOT_FOUND)', async () => {
    const { pills, useCase } = setup();
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('nobody', 'a', 1);
    await expect(useCase.execute('nobody', 'a')).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('restores the decremented pill when the character update loses the concurrency guard', async () => {
    const { characters, pills, useCase } = setup();
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 1);

    // Simulate losing the optimistic-concurrency race: another request wrote
    // between this use case's read and its guarded update, so the guard misses.
    characters.updateWithConcurrencyGuard = async () => null;

    await expect(useCase.execute('user-1', 'a')).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });

    // The unit spent by decrementOne must have been given back.
    const inv = await pills.listInventory('user-1');
    expect(inv.find((e) => e.pill.id === 'a')?.quantity).toBe(1);
  });
});
