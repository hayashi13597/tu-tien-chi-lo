import { DomainError } from '../domain/errors';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { ExpeditionConfigRepository } from '../domain/ports/ExpeditionConfigRepository';
import { ExpeditionRepository } from '../domain/ports/ExpeditionRepository';
import { GetCultivationStateUseCase } from './GetCultivationStateUseCase';
import { activeSkillPower } from '../domain/combat/combat.calc';
import { SeededRandom } from '../domain/combat/seeded-random';
import { simulateExpedition } from '../domain/expedition/expedition.calc';
import { ExpeditionDifficultyKey } from '../domain/expedition/expedition';
import { RandomSource } from '../domain/ports/RandomSource';
import { ticketCostForDuration } from '../domain/materials/material.calc';
import { gameDayFor } from '../domain/expedition/expedition.calc';

export class StartExpeditionUseCase {
  constructor(
    private readonly config: ExpeditionConfigRepository,
    private readonly expeditions: ExpeditionRepository,
    private readonly cultivation: GetCultivationStateUseCase,
    private readonly ownedCongPhap: OwnedCongPhapRepository,
    private readonly random: RandomSource,
  ) {}

  async execute(userId: string, input: { branchId: string; difficulty: ExpeditionDifficultyKey; durationSec: 1_800 | 7_200 | 28_800 }, now = new Date()) {
    const bundle = await this.config.getBranch(input.branchId);
    if (!bundle) throw new DomainError('EXPEDITION_BRANCH_NOT_FOUND', `branch not found: ${input.branchId}`);
    const difficulty = bundle.difficulties.find((item) => item.key === input.difficulty);
    if (!difficulty) throw new DomainError('EXPEDITION_DIFFICULTY_NOT_FOUND', `difficulty not found: ${input.difficulty}`);
    const ticketCostUnits = ticketCostForDuration(input.durationSec);
    const state = await this.cultivation.execute(userId);
    const owned = await this.ownedCongPhap.listByUser(userId);
    const skills = owned
      .filter((entry) => entry.def.active && entry.def.category === 'active' && entry.equippedSlot !== null)
      .map((entry) => ({
        id: entry.def.id,
        power: activeSkillPower(entry.def.powerPerLevel, entry.level),
        chanNguyenCost: entry.def.chanNguyenCost ?? 0,
        cooldownRounds: entry.def.cooldownRounds ?? 0,
        slot: entry.equippedSlot as number,
      }));
    const combatSnapshot = {
      player: { id: 'player' as const, attributes: state.attributes.final, battlePower: state.battlePower, maxChanNguyen: state.attributes.final.chanNguyen, skills },
      realmMajor: state.realmMajor,
      realmSub: state.realmSub,
      realmMultiplier: 1 + state.realmMajor * 0.25,
      realmReferencePower: Math.max(1, 100 * (state.realmMajor + 1)),
    };
    const seed = Math.floor(this.random.next() * 4_294_967_296) >>> 0;
    const combatResult = simulateExpedition({
      player: combatSnapshot.player,
      branch: bundle.branch,
      difficulty,
      realmMultiplier: combatSnapshot.realmMultiplier,
      realmReferencePower: combatSnapshot.realmReferencePower,
      ticketCostUnits,
      random: new SeededRandom(seed),
      maxTurns: 50,
    });
    return this.expeditions.start({
      userId,
      branchId: input.branchId,
      difficulty: input.difficulty,
      durationSec: input.durationSec,
      ticketCostUnits,
      gameDay: gameDayFor(now),
      now,
      seed,
      combatSnapshot,
      combatResult,
      rewardResult: combatResult.reward,
    });
  }
}
