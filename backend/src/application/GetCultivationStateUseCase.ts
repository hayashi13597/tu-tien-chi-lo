import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR } from '../infrastructure/config/realms';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { isMaxStage } from '../domain/breakthrough/breakthrough.calc';

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
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
    });

    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();
    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR);

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
    };
  }
}
