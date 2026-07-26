import { ExpeditionCatalogAdminRepository } from '../domain/ports/ExpeditionCatalogAdminRepository';
import { ExpeditionBranchBundle } from '../domain/ports/ExpeditionConfigRepository';

export class ListExpeditionConfigAdminUseCase {
  constructor(private readonly repo: ExpeditionCatalogAdminRepository) {}
  async execute(): Promise<ExpeditionBranchBundle[]> { return this.repo.list(); }
}
