import { PillRepository } from '../domain/ports/PillRepository';
import { PillRecord } from '../domain/pills/pill';

export class ListPillsAdminUseCase {
  constructor(private readonly pills: PillRepository) {}

  // Admin catalog view: includes inactive pills (players never see this list).
  async execute(): Promise<PillRecord[]> {
    return this.pills.listAll();
  }
}
