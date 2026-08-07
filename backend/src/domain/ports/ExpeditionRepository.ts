import { ClaimExpeditionOutput, CurrentExpeditionOutput, ExpeditionRecord, ExpeditionCombatSnapshot, ExpeditionDifficultyKey, ExpeditionSimulation } from '../expedition/expedition';
import { RewardPayload } from '../expedition/expedition';

export interface ExpeditionRepository {
  start(input: {
    userId: string;
    branchId: string;
    difficulty: ExpeditionDifficultyKey;
    durationSec: 1_800 | 7_200 | 28_800;
    ticketCostUnits: 1 | 2 | 4;
    gameDay: string;
    now: Date;
    seed: number;
    combatSnapshot: ExpeditionCombatSnapshot;
    combatResult: ExpeditionSimulation;
    rewardResult: RewardPayload;
    // Phase 3 — đan loadout trừ nguyên tử trong transaction start.
    loadoutConsumptions?: readonly { pillId: string; quantity: number }[];
  }): Promise<ExpeditionRecord>;
  getCurrent(userId: string, now: Date): Promise<CurrentExpeditionOutput>;
  claim(userId: string, now: Date): Promise<ClaimExpeditionOutput>;
}
