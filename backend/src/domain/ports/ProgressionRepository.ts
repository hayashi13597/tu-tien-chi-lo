export type LevelUpWithCostsResult =
  | { kind: 'updated'; level: number; linhThach: number; materialQuantity: number }
  | { kind: 'insufficient-linh-thach' }
  | { kind: 'insufficient-materials' }
  | { kind: 'concurrent' };

// Học môn bằng Bí Tịch (Phase 2): 1 Bí Tịch + Linh Thạch → OwnedCongPhap level 1.
export type LearnWithCostsResult =
  | { kind: 'learned'; linhThach: number; biTichQuantity: number }
  | { kind: 'missing-bitich' }
  | { kind: 'insufficient-linh-thach' }
  | { kind: 'already-owned' }
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

  // Một transaction Serializable: tạo owned (P2002 -> already-owned), trừ 1 Bí Tịch
  // (guard quantity >= 1), trừ Linh Thạch (guard gte). Rollback nguyên khi thiếu.
  learnWithCosts(input: {
    userId: string;
    congPhapId: string;
    biTichMaterialId: string;
    linhThachCost: number;
  }): Promise<LearnWithCostsResult>;
}
