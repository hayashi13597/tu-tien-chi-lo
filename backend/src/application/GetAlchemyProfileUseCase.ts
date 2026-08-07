import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import {
  FURNACE_UPGRADES, MAX_RANK, RANK_REALM_GATES, RANK_UP_COSTS,
  furnaceSpeedPct, furnaceSuccessPct, rankSpeedPct, rankSuccessPct,
} from '../domain/alchemy/alchemy.profile';

export interface AlchemyProfileSummary {
  profile: { rank: number; danKhi: number; furnaceLevel: number };
  successBonusPct: number;
  speedBonusPct: number;
  nextRank: {
    target: number; danKhiCost: number; realmGateMajor: number | null; realmMet: boolean;
    affordable: boolean; locked: boolean;
  } | null;
  nextFurnace: {
    target: number; danKhiCost: number; linhThachCost: number;
    affordableDanKhi: boolean; affordableLinhThach: boolean;
  } | null;
}

export class GetAlchemyProfileUseCase {
  constructor(
    private readonly alchemy: AlchemyRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(userId: string): Promise<AlchemyProfileSummary> {
    const profile = await this.alchemy.getProfile(userId);
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);

    // Đã MAX_RANK (hoặc lò max) thì bước kế tiếp là null — UI hiển thị trạng thái cap.
    const nextTarget = profile.rank + 1;
    const nextRank = nextTarget > MAX_RANK ? null : {
      target: nextTarget,
      danKhiCost: RANK_UP_COSTS[nextTarget] ?? 0,
      realmGateMajor: RANK_REALM_GATES[nextTarget] ?? null,
      realmMet: character.realmMajor >= (RANK_REALM_GATES[nextTarget] ?? 0),
      affordable: profile.danKhi >= (RANK_UP_COSTS[nextTarget] ?? Number.POSITIVE_INFINITY),
      locked: false,
    };
    const furnaceTarget = profile.furnaceLevel + 1;
    const furnaceCost = FURNACE_UPGRADES[furnaceTarget];
    const nextFurnace = !furnaceCost ? null : {
      target: furnaceTarget,
      danKhiCost: furnaceCost.danKhi,
      linhThachCost: furnaceCost.linhThach,
      affordableDanKhi: profile.danKhi >= furnaceCost.danKhi,
      affordableLinhThach: character.linhThach >= furnaceCost.linhThach,
    };
    return {
      profile: { rank: profile.rank, danKhi: profile.danKhi, furnaceLevel: profile.furnaceLevel },
      successBonusPct: rankSuccessPct(profile.rank) + furnaceSuccessPct(profile.furnaceLevel),
      speedBonusPct: rankSpeedPct(profile.rank) + furnaceSpeedPct(profile.furnaceLevel),
      nextRank,
      nextFurnace,
    };
  }
}
