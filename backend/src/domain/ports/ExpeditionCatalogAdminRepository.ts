import { ExpeditionBranchBundle } from './ExpeditionConfigRepository';

export interface ExpeditionCatalogAdminRepository {
  list(): Promise<ExpeditionBranchBundle[]>;
  replace(rows: readonly ExpeditionBranchBundle[]): Promise<ExpeditionBranchBundle[]>;
}
