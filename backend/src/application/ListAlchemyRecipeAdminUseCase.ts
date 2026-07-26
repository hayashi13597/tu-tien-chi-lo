import { AlchemyCatalogAdminRepository } from '../domain/ports/AlchemyCatalogAdminRepository';
import { AlchemyRecipeRecord } from '../domain/alchemy/alchemy';

export class ListAlchemyRecipeAdminUseCase {
  constructor(private readonly repo: AlchemyCatalogAdminRepository) {}
  async execute(): Promise<AlchemyRecipeRecord[]> { return this.repo.list(); }
}
