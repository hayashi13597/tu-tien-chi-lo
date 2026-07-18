import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { PillRepository } from '../domain/ports/PillRepository';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR, MAX_REALM_SUB } from '../domain/config/realms';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { isMaxStage, computeSuccessRate } from '../domain/breakthrough/breakthrough.calc';
import { applyPillEffect } from '../domain/pills/pill.calc';
import { CultivationStateOutput } from './GetCultivationStateUseCase';

export class ConsumePillUseCase {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly pills: PillRepository,
  ) {}

  async execute(userId: string, pillId: string): Promise<CultivationStateOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }
    const pill = await this.pills.findById(pillId);
    if (!pill) {
      throw new DomainError('PILL_NOT_FOUND', 'Pill not found');
    }

    const stage = REALMS[character.realmMajor].subStages[character.realmSub];
    const now = new Date();
    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR, MAX_REALM_SUB);
    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();

    // Applicability guards (before spending the pill): a pill that can't do
    // anything must not be consumed.
    if (pill.effectKind === 'clearPunishment' && !punished) {
      throw new DomainError('PILL_NOT_APPLICABLE', 'Not currently punished');
    }
    if ((pill.effectKind === 'linhKhi' || pill.effectKind === 'breakthroughBoost') && atMax) {
      throw new DomainError('PILL_NOT_APPLICABLE', 'Already at the maximum realm');
    }

    // Recompute lazily-accrued linh khi (respecting any active buff) up front.
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

    // Spend the pill FIRST. decrementOne is a row-level atomic guard, so two
    // concurrent consumes of the last unit can't both proceed — the loser gets
    // false here and never applies the effect.
    const decremented = await this.pills.decrementOne(userId, pillId);
    if (!decremented) {
      throw new DomainError('PILL_OUT_OF_STOCK', 'No units of this pill remaining');
    }

    const effect = applyPillEffect({ currentLinhKhi, character, pill, now });

    // Persist via the optimistic-concurrency guard, carrying every field.
    const updated = await this.characters.updateWithConcurrencyGuard(character.id, character.lastUpdateAt, {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      linhKhi: effect.linhKhi,
      lastUpdateAt: now,
      breakthroughFails: character.breakthroughFails,
      punishedUntil: effect.punishedUntil,
      cultivationBuffMultiplier: effect.cultivationBuffMultiplier,
      cultivationBuffUntil: effect.cultivationBuffUntil,
      breakthroughBonusPct: effect.breakthroughBonusPct,
    });
    if (!updated) {
      // Compensate: the effect was never applied, so give the unit back —
      // otherwise a lost concurrency race would silently burn the pill.
      // (Saga-style compensation rather than a cross-repository transaction,
      // which would leak a unit-of-work/Prisma concern into this layer.)
      await this.pills.incrementOne(userId, pillId);
      throw new DomainError('CONCURRENT_MODIFICATION', 'Character was modified by another request');
    }

    // Return the fresh cultivation state (same shape GET /cultivation/state uses).
    const newStage = REALMS[updated.realmMajor].subStages[updated.realmSub];
    const newAtMax = isMaxStage(updated.realmMajor, updated.realmSub, MAX_REALM_MAJOR, MAX_REALM_SUB);
    const newPunished = updated.punishedUntil !== null && updated.punishedUntil.getTime() > now.getTime();
    return {
      realmMajor: updated.realmMajor,
      realmSub: updated.realmSub,
      realmName: `${REALMS[updated.realmMajor].name} - ${newStage.name}`,
      linhKhi: updated.linhKhi,
      linhKhiRequired: newStage.linhKhiRequired,
      canBreakthrough: !newAtMax && !newPunished && updated.linhKhi >= newStage.linhKhiRequired,
      isMaxStage: newAtMax,
      punishedUntil: updated.punishedUntil,
      cultivationRate: newStage.cultivationRate,
      cultivationBuffMultiplier: updated.cultivationBuffMultiplier,
      cultivationBuffUntil: updated.cultivationBuffUntil,
      breakthroughBonusPct: updated.breakthroughBonusPct,
      // Recompute against the post-consume character (a breakthroughBoost pill
      // just changed breakthroughBonusPct), so the returned rate is current.
      breakthroughSuccessRate: computeSuccessRate({
        baseSuccessRate: newStage.baseSuccessRate,
        pityIncrement: newStage.pityIncrement,
        maxSuccessRate: newStage.maxSuccessRate,
        breakthroughFails: updated.breakthroughFails,
        bonusPct: updated.breakthroughBonusPct,
      }),
    };
  }
}
