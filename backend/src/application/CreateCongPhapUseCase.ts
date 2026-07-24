import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CongPhapRecord } from '../domain/congphap/congphap';
import { validateCongPhapDefinition } from '../domain/congphap/congphap.validate';
import { DomainError } from '../domain/errors';

export class CreateCongPhapUseCase {
  constructor(private readonly congphap: CongPhapRepository) {}
  async execute(def: CongPhapRecord): Promise<CongPhapRecord> {
    validateCongPhapDefinition(def);
    // Check-then-create (admin-only path; concurrent dup hits PK -> 500, chấp nhận).
    if (await this.congphap.findById(def.id)) {
      throw new DomainError('CONGPHAP_ID_TAKEN', `Công pháp id "${def.id}" đã tồn tại`);
    }
    await this.congphap.create(def);
    return def;
  }
}
