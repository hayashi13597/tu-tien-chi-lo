import { ExpeditionBranchConfig, ExpeditionDifficultyConfig } from '../expedition/expedition';

export interface ExpeditionBranchBundle {
  branch: ExpeditionBranchConfig;
  difficulties: ExpeditionDifficultyConfig[];
}

export interface ExpeditionConfigRepository {
  listBranches(): Promise<ExpeditionBranchBundle[]>;
  getBranch(branchId: string): Promise<ExpeditionBranchBundle | null>;
}
