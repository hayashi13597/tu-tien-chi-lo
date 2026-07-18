import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { RandomSource } from '../domain/ports/RandomSource';
import { DomainError } from '../domain/errors';
import { RealmConfigSource } from '../domain/ports/RealmConfigSource';
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
    private readonly realmConfig: RealmConfigSource,
  ) {}

  async execute(userId: string): Promise<AttemptBreakthroughOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const config = this.realmConfig.get();
    const stage = config.getStage(character.realmMajor, character.realmSub);
    const now = new Date();
    // Recompute lazily-accrued linh khi (respecting any active buff) once, up
    // front. Every branch below (including the three rejection paths) persists
    // this value as its first write, so a rejected attempt never silently drops
    // accrued progress.
    const buff =
      character.cultivationBuffMultiplier !== null && character.cultivationBuffUntil !== null
        ? { multiplier: character.cultivationBuffMultiplier, until: character.cultivationBuffUntil }
        : undefined;
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
      buff,
    });

    const atMax = isMaxStage(character.realmMajor, character.realmSub, config.maxRealmMajor, config.peakRealmSub(character.realmMajor));
    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();

    if (atMax) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: character.breakthroughBonusPct,
      });
      throw new DomainError('MAX_STAGE_REACHED', 'Already at the maximum realm and substage');
    }

    if (punished) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: character.breakthroughBonusPct,
      });
      throw new DomainError('PUNISHED', 'Currently punished after a failed breakthrough');
    }

    if (currentLinhKhi < stage.linhKhiRequired) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: character.breakthroughBonusPct,
      });
      throw new DomainError('INSUFFICIENT_LINH_KHI', 'Not enough linh khi to attempt a breakthrough');
    }

    const successRate = computeSuccessRate({
      baseSuccessRate: stage.baseSuccessRate,
      pityIncrement: stage.pityIncrement,
      maxSuccessRate: stage.maxSuccessRate,
      breakthroughFails: character.breakthroughFails,
      bonusPct: character.breakthroughBonusPct,
    });
    const succeeded = rollSuccess(successRate, this.randomSource.next());

    if (succeeded) {
      const { realmMajor, realmSub } = nextStage(character.realmMajor, character.realmSub, config.peakRealmSub(character.realmMajor));
      const updated = await this.persist(character, currentLinhKhi - stage.linhKhiRequired, now, {
        realmMajor,
        realmSub,
        breakthroughFails: 0,
        punishedUntil: null,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: 0,
      });
      return { success: true, character: updated };
    }

    const updated = await this.persist(character, currentLinhKhi, now, {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      breakthroughFails: character.breakthroughFails + 1,
      punishedUntil: new Date(now.getTime() + stage.punishmentSeconds * 1000),
      cultivationBuffMultiplier: character.cultivationBuffMultiplier,
      cultivationBuffUntil: character.cultivationBuffUntil,
      breakthroughBonusPct: 0,
    });
    return { success: false, character: updated };
  }

  private async persist(
    original: CharacterRecord,
    linhKhi: number,
    lastUpdateAt: Date,
    rest: { realmMajor: number; realmSub: number; breakthroughFails: number; punishedUntil: Date | null; cultivationBuffMultiplier: number | null; cultivationBuffUntil: Date | null; breakthroughBonusPct: number },
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
