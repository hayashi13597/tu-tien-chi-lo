export type LevelUpWithCostsResult =
  | { kind: 'updated'; level: number; linhThach: number; materialQuantity: number }
  | { kind: 'insufficient-linh-thach' }
  | { kind: 'insufficient-materials' }
  | { kind: 'concurrent' };

export interface ProgressionRepository {
  levelUpWithCosts(input: {
    userId: string;
    congPhapId: string;
    expectedLevel: number;
    linhThachCost: number;
    materialId: string | null;
    materialCost: number;
  }): Promise<LevelUpWithCostsResult>;
}
