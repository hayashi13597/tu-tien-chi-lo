import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { RealmConfigSource } from '../domain/ports/RealmConfigSource';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { isMaxStage, computeSuccessRate } from '../domain/breakthrough/breakthrough.calc';

export interface CultivationStateOutput {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  linhKhi: number;
  linhKhiRequired: number;
  canBreakthrough: boolean;
  isMaxStage: boolean;
  punishedUntil: Date | null;
  cultivationRate: number;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
  // The success chance (percentage) the next breakthrough attempt would use:
  // the stage base rate + pity for accumulated fails + any pending boost pill,
  // clamped to the stage cap. Read-only mirror of AttemptBreakthroughUseCase's
  // computeSuccessRate so the client can show it without knowing the formula.
  breakthroughSuccessRate: number;
}

export class GetCultivationStateUseCase {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly realmConfig: RealmConfigSource,
  ) {}

  async execute(userId: string): Promise<CultivationStateOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const config = this.realmConfig.get();
    // Self-heal: if the stored stage no longer exists in the current config
    // (e.g. an admin removed a realm/sub-stage under this character), clamp to
    // the nearest valid stage and persist the correction. This is the read path,
    // so it also removes the previous out-of-range 500. Uses the existing
    // optimistic-concurrency guard; a lost race just means another request
    // already wrote — we fall through with the clamped indices for this response.
    const clamped = config.clampStage(character.realmMajor, character.realmSub);
    if (clamped.realmMajor !== character.realmMajor || clamped.realmSub !== character.realmSub) {
      character.realmMajor = clamped.realmMajor;
      character.realmSub = clamped.realmSub;
      await this.characters.updateWithConcurrencyGuard(character.id, character.lastUpdateAt, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        linhKhi: character.linhKhi,
        lastUpdateAt: character.lastUpdateAt,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: character.breakthroughBonusPct,
      });
    }
    const stage = config.getStage(character.realmMajor, character.realmSub);
    const now = new Date();
    // Reflect any active timed cultivation buff on the read path too, so the
    // client's polled state shows the faster accrual while the buff lasts —
    // otherwise a consumed buff would only take visible effect on the next
    // write (consume/breakthrough), defeating its purpose.
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

    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();
    const atMax = isMaxStage(character.realmMajor, character.realmSub, config.maxRealmMajor, config.peakRealmSub(character.realmMajor));

    // Same inputs AttemptBreakthroughUseCase feeds computeSuccessRate, so the
    // displayed chance matches what an attempt right now would actually roll.
    const breakthroughSuccessRate = computeSuccessRate({
      baseSuccessRate: stage.baseSuccessRate,
      pityIncrement: stage.pityIncrement,
      maxSuccessRate: stage.maxSuccessRate,
      breakthroughFails: character.breakthroughFails,
      bonusPct: character.breakthroughBonusPct,
    });

    return {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      realmName: `${config.realmName(character.realmMajor)} - ${stage.name}`,
      linhKhi: currentLinhKhi,
      linhKhiRequired: stage.linhKhiRequired,
      // This is a read path: it never persists, so `canBreakthrough` only informs
      // the client UI — POST /cultivation/breakthrough re-validates everything itself.
      canBreakthrough: !atMax && !punished && currentLinhKhi >= stage.linhKhiRequired,
      isMaxStage: atMax,
      punishedUntil: character.punishedUntil,
      cultivationRate: stage.cultivationRate,
      cultivationBuffMultiplier: character.cultivationBuffMultiplier,
      cultivationBuffUntil: character.cultivationBuffUntil,
      breakthroughBonusPct: character.breakthroughBonusPct,
      breakthroughSuccessRate,
    };
  }
}
