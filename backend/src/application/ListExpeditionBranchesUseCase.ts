import { ExpeditionConfigRepository } from '../domain/ports/ExpeditionConfigRepository';
import { ExpeditionBranchBundle } from '../domain/ports/ExpeditionConfigRepository';

export class ListExpeditionBranchesUseCase {
  constructor(private readonly config: ExpeditionConfigRepository) {}

  async execute(): Promise<ExpeditionBranchBundle[]> {
    return this.config.listBranches();
  }
}
