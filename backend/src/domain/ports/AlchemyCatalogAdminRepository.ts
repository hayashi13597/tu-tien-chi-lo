import { AlchemyRecipeRecord } from '../alchemy/alchemy';

export interface AlchemyCatalogAdminRepository {
  list(): Promise<AlchemyRecipeRecord[]>;
  replace(rows: readonly AlchemyRecipeRecord[]): Promise<AlchemyRecipeRecord[]>;
}
