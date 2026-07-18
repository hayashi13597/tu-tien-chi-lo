import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR } from '../domain/config/realms';
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
  constructor(private readonly characters: CharacterRepository) {}

  async execute(userId: string): Promise<CultivationStateOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const stage = REALMS[character.realmMajor].subStages[character.realmSub];
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
    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR);

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
      realmName: `${REALMS[character.realmMajor].name} - ${stage.name}`,
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
