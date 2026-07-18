import { describe, it, expect } from 'vitest';
import { AttemptBreakthroughUseCase } from '../../src/application/AttemptBreakthroughUseCase';
import { InMemoryCharacterRepository } from '../fakes/InMemoryCharacterRepository';
import { FixedRandomSource } from '../fakes/FixedRandomSource';
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

describe('AttemptBreakthroughUseCase', () => {
  it('rejects an unknown user with CHARACTER_NOT_FOUND', async () => {
    const useCase = new AttemptBreakthroughUseCase(new InMemoryCharacterRepository(), new FixedRandomSource(0));
    await expect(useCase.execute('nobody')).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('rejects with INSUFFICIENT_LINH_KHI when below the requirement, but still persists accrued linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 10 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_KHI' });

    const state = await characters.findByUserId('user-1');
    // A small amount of real wall-clock time elapses between seeding and the
    // assertion, so an exact 10 is not guaranteed — assert within a tight tolerance.
    expect(state?.linhKhi).toBeCloseTo(10, 1);
  });

  it('rejects with PUNISHED while punishedUntil is in the future, but still persists accrued linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 500, punishedUntil: new Date(Date.now() + 60_000) }));
    // Count calls to the write method: this is a deterministic, clock-independent
    // way to prove persist() actually ran on this rejection path, which is the
    // whole point of this task's "persist first, validate second" design — a
    // future refactor that moved the throw ahead of the persist call for just
    // this branch would silently drop accrued linh khi without this check.
    let updateCalls = 0;
    const originalUpdate = characters.updateWithConcurrencyGuard.bind(characters);
    characters.updateWithConcurrencyGuard = async (id, expectedLastUpdateAt, data) => {
      updateCalls += 1;
      return originalUpdate(id, expectedLastUpdateAt, data);
    };
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'PUNISHED' });

    expect(updateCalls).toBe(1);
    const state = await characters.findByUserId('user-1');
    // linh khi only ever increases with elapsed time, never decreases — this
    // avoids a rate-dependent tolerance (unlike toBeCloseTo, which would need
    // a different tolerance per realm's very different cultivationRate).
    expect(state?.linhKhi).toBeGreaterThanOrEqual(500);
  });

  it('rejects with MAX_STAGE_REACHED at Thái Ất - Viên Mãn, but still persists accrued linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ realmMajor: 11, realmSub: 4, linhKhi: 999_999_999 }));
    let updateCalls = 0;
    const originalUpdate = characters.updateWithConcurrencyGuard.bind(characters);
    characters.updateWithConcurrencyGuard = async (id, expectedLastUpdateAt, data) => {
      updateCalls += 1;
      return originalUpdate(id, expectedLastUpdateAt, data);
    };
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'MAX_STAGE_REACHED' });

    expect(updateCalls).toBe(1);
    const state = await characters.findByUserId('user-1');
    // Thái Ất - Viên Mãn has a very high cultivationRate (255.09/s), so a
    // fixed absolute tolerance (toBeCloseTo) would be flaky here even for a
    // few ms of elapsed time — a monotonic lower bound is rate-independent.
    expect(state?.linhKhi).toBeGreaterThanOrEqual(999_999_999);
  });

  it('advances the substage, carries over excess linh khi, and resets fails on success', async () => {
    const characters = new InMemoryCharacterRepository();
    // Phàm Nhân - Sơ requires 100 linh khi; seed exactly 150 so 50 carries over.
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughFails: 2 }));
    // randomValue 0 always beats any positive success rate (rollSuccess: randomValue*100 < rate).
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    const result = await useCase.execute('user-1');

    expect(result.success).toBe(true);
    expect(result.character.realmMajor).toBe(0);
    expect(result.character.realmSub).toBe(1);
    expect(result.character.linhKhi).toBeCloseTo(50, 1);
    expect(result.character.breakthroughFails).toBe(0);
    expect(result.character.punishedUntil).toBeNull();
  });

  it('sets punishedUntil and increments breakthroughFails on failure, without deducting linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughFails: 0 }));
    // randomValue 0.999 beats no realistic success rate (< 99.9%), forcing failure.
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0.999));

    const result = await useCase.execute('user-1');

    expect(result.success).toBe(false);
    expect(result.character.realmMajor).toBe(0);
    expect(result.character.realmSub).toBe(0);
    expect(result.character.linhKhi).toBeCloseTo(150, 1);
    expect(result.character.breakthroughFails).toBe(1);
    expect(result.character.punishedUntil).not.toBeNull();
  });

  it('rolls over realmMajor when breaking through from Viên Mãn (peak substage 4)', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ realmMajor: 0, realmSub: 4, linhKhi: 500 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    const result = await useCase.execute('user-1');

    expect(result.character.realmMajor).toBe(1);
    expect(result.character.realmSub).toBe(0);
  });

  it('throws CONCURRENT_MODIFICATION if the character was modified between read and write', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    // Simulate another request winning the race between execute()'s read and
    // its write: intercept the fake's write method so that, on the first
    // call only, it mutates the stored lastUpdateAt out from under the
    // in-flight execute() before delegating to the real update logic. This
    // makes the real updateWithConcurrencyGuard's expectedLastUpdateAt check
    // fail exactly as it would if a second request had truly won the race.
    const originalUpdate = characters.updateWithConcurrencyGuard.bind(characters);
    let callCount = 0;
    characters.updateWithConcurrencyGuard = async (id, expectedLastUpdateAt, data) => {
      callCount += 1;
      if (callCount === 1) {
        const winner = await characters.findByUserId('user-1');
        if (winner) {
          await originalUpdate(id, winner.lastUpdateAt, {
            realmMajor: winner.realmMajor,
            realmSub: winner.realmSub,
            linhKhi: winner.linhKhi,
            lastUpdateAt: new Date(winner.lastUpdateAt.getTime() + 1),
            breakthroughFails: winner.breakthroughFails,
            punishedUntil: winner.punishedUntil,
          });
        }
      }
      return originalUpdate(id, expectedLastUpdateAt, data);
    };

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
  });
});

describe('AttemptBreakthroughUseCase breakthrough bonus', () => {
  it('applies breakthroughBonusPct and resets it to 0 on success', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughBonusPct: 30 }));
    // Roll 0.92 → 92, above the base rate (90, so this would FAIL without the
    // bonus) but below the boosted rate (min(90+30, cap 95) = 95). Success here
    // proves the bonus actually entered the rate, not just that the roll was low.
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0.92));
    const result = await useCase.execute('user-1');
    expect(result.success).toBe(true);
    expect(result.character.breakthroughBonusPct).toBe(0);
  });

  it('resets breakthroughBonusPct to 0 on failure too', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughBonusPct: 10 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0.999));
    const result = await useCase.execute('user-1');
    expect(result.success).toBe(false);
    expect(result.character.breakthroughBonusPct).toBe(0);
  });

  it('leaves breakthroughBonusPct untouched on a rejected attempt (insufficient)', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 10, breakthroughBonusPct: 25 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));
    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_KHI' });
    const saved = await characters.findByUserId('user-1');
    expect(saved?.breakthroughBonusPct).toBe(25);
  });
});
