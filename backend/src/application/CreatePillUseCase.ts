import { PillRepository } from '../domain/ports/PillRepository';
import { PillRecord } from '../domain/pills/pill';
import { validatePillDefinition } from '../domain/pills/pill.validate';
import { DomainError } from '../domain/errors';

export class CreatePillUseCase {
  constructor(private readonly pills: PillRepository) {}

  async execute(record: PillRecord): Promise<PillRecord> {
    validatePillDefinition(record);
    // Check-then-create: a concurrent duplicate racing past this check hits the
    // DB primary-key constraint and surfaces as a 500 — acceptable for an
    // admin-only path (see spec), not worth a transaction here.
    const existing = await this.pills.findById(record.id);
    if (existing) {
      throw new DomainError('PILL_ID_TAKEN', `A pill with id "${record.id}" already exists`);
    }
    await this.pills.create(record);
    return record;
  }
}
