import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { RandomSource } from '../domain/ports/RandomSource';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR } from '../infrastructure/config/realms';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { computeSuccessRate, rollSuccess, nextStage, isMaxStage } from '../domain/breakthrough/breakthrough.calc';
import { CharacterRecord } from '../domain/entities/Character';

export interface AttemptBreakthroughOutput {
  success: boolean;
  character: CharacterRecord;
}

export class AttemptBreakthroughUseCase {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly randomSource: RandomSource,
  ) {}

  async execute(userId: string): Promise<AttemptBreakthroughOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const stage = REALMS[character.realmMajor].subStages[character.realmSub];
    const now = new Date();
    // Recompute lazily-accrued linh khi once, up front. Every branch below
    // (including the three rejection paths) persists this value as its first
    // write, so a rejected attempt never silently drops accrued progress.
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
    });

    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR);
    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();

    if (atMax) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
      });
      throw new DomainError('MAX_STAGE_REACHED', 'Already at the maximum realm and substage');
    }

    if (punished) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
      });
      throw new DomainError('PUNISHED', 'Currently punished after a failed breakthrough');
    }

    if (currentLinhKhi < stage.linhKhiRequired) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
      });
      throw new DomainError('INSUFFICIENT_LINH_KHI', 'Not enough linh khi to attempt a breakthrough');
    }

    const successRate = computeSuccessRate({
      baseSuccessRate: stage.baseSuccessRate,
      pityIncrement: stage.pityIncrement,
      maxSuccessRate: stage.maxSuccessRate,
      breakthroughFails: character.breakthroughFails,
    });
    const succeeded = rollSuccess(successRate, this.randomSource.next());

    if (succeeded) {
      const { realmMajor, realmSub } = nextStage(character.realmMajor, character.realmSub);
      const updated = await this.persist(character, currentLinhKhi - stage.linhKhiRequired, now, {
        realmMajor,
        realmSub,
        breakthroughFails: 0,
        punishedUntil: null,
      });
      return { success: true, character: updated };
    }

    const updated = await this.persist(character, currentLinhKhi, now, {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      breakthroughFails: character.breakthroughFails + 1,
      punishedUntil: new Date(now.getTime() + stage.punishmentSeconds * 1000),
    });
    return { success: false, character: updated };
  }

  private async persist(
    original: CharacterRecord,
    linhKhi: number,
    lastUpdateAt: Date,
    rest: { realmMajor: number; realmSub: number; breakthroughFails: number; punishedUntil: Date | null },
  ): Promise<CharacterRecord> {
    // Scoped to the lastUpdateAt read at the top of execute(): if another
    // request already wrote to this character first, lastUpdateAt on the row
    // no longer matches and the guard returns null — preventing two
    // concurrent breakthrough attempts from double-advancing one character.
    const updated = await this.characters.updateWithConcurrencyGuard(original.id, original.lastUpdateAt, {
      linhKhi,
      lastUpdateAt,
      ...rest,
    });
    if (!updated) {
      throw new DomainError('CONCURRENT_MODIFICATION', 'Character was modified by another request');
    }
    return updated;
  }
}
