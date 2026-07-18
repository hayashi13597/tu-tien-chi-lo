import { describe, it, expect } from 'vitest';
import { GetCultivationStateUseCase } from '../../src/application/GetCultivationStateUseCase';
import { InMemoryCharacterRepository } from '../fakes/InMemoryCharacterRepository';
import { CharacterRecord } from '../../src/domain/entities/Character';

function makeCharacter(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-1',
    userId: 'user-1',
    realmMajor: 0,
    realmSub: 0,
    linhKhi: 0,
    lastUpdateAt: new Date(),
    breakthroughFails: 0,
    punishedUntil: null,
    createdAt: new Date(),
    cultivationBuffMultiplier: null,
    cultivationBuffUntil: null,
    breakthroughBonusPct: 0,
    ...overrides,
  };
}

describe('GetCultivationStateUseCase', () => {
  it('rejects an unknown user with CHARACTER_NOT_FOUND', async () => {
    const useCase = new GetCultivationStateUseCase(new InMemoryCharacterRepository());
    await expect(useCase.execute('nobody')).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('reports canBreakthrough=false and isMaxStage=false for a fresh Phàm Nhân - Sơ character', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter());
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.realmName).toBe('Phàm Nhân - Sơ');
    expect(result.linhKhiRequired).toBe(100);
    expect(result.canBreakthrough).toBe(false);
    expect(result.isMaxStage).toBe(false);
    // Phàm Nhân - Sơ base rate, no fails, no boost => the raw base success rate.
    expect(result.breakthroughSuccessRate).toBe(90);
  });

  it('raises the reported breakthrough success rate with pity and a pending boost', async () => {
    const characters = new InMemoryCharacterRepository();
    // 2 fails at Phàm Nhân - Sơ (pity +10 each) + a 15% pending boost:
    // 90 + 2*10 + 15 = 125, clamped to the stage cap of 95.
    characters.seed(makeCharacter({ breakthroughFails: 2, breakthroughBonusPct: 15 }));
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.breakthroughSuccessRate).toBe(95);
  });

  it('reports canBreakthrough=true once accrued linh khi reaches the requirement', async () => {
    const characters = new InMemoryCharacterRepository();
    const lastUpdateAt = new Date(Date.now() - 200_000); // 200s ago, rate 1.0/s => +200
    characters.seed(makeCharacter({ linhKhi: 0, lastUpdateAt }));
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.linhKhi).toBeGreaterThanOrEqual(100);
    expect(result.canBreakthrough).toBe(true);
  });

  it('reports canBreakthrough=false while punishedUntil is in the future, even with enough linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 500, punishedUntil: new Date(Date.now() + 60_000) }));
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.canBreakthrough).toBe(false);
  });

  it('reflects an active cultivation buff in the accrued linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    const lastUpdateAt = new Date(Date.now() - 100_000); // 100s ago, base rate 1.0/s
    // ×2 buff still active well into the future: 100s should accrue ~200, not ~100.
    characters.seed(makeCharacter({
      linhKhi: 0,
      lastUpdateAt,
      cultivationBuffMultiplier: 2,
      cultivationBuffUntil: new Date(Date.now() + 60_000),
    }));
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    // ~200 with a tight band: the use case's own `new Date()` runs a beat after
    // the seed's Date.now(), so slightly over 200 is expected — but severe
    // over-accrual (e.g. the buff applied to the wrong segment) must still fail.
    expect(result.linhKhi).toBeGreaterThanOrEqual(199);
    expect(result.linhKhi).toBeLessThan(203);
  });
});
