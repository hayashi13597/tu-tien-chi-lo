import { PillRepository } from '../domain/ports/PillRepository';
import { PillRecord } from '../domain/pills/pill';
import { validatePillDefinition } from '../domain/pills/pill.validate';
import { DomainError } from '../domain/errors';

export class UpdatePillUseCase {
  constructor(private readonly pills: PillRepository) {}

  // Full-row update; id comes from the route param and is immutable (it is the
  // inventory FK key). Enable/disable flows through here too — `active` is just
  // a field of the record.
  async execute(record: PillRecord): Promise<PillRecord> {
    validatePillDefinition(record);
    const ok = await this.pills.update(record);
    if (!ok) {
      throw new DomainError('PILL_NOT_FOUND', 'Pill not found');
    }
    return record;
  }
}
