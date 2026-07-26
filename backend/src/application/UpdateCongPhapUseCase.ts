import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CongPhapRecord } from '../domain/congphap/congphap';
import { validateCongPhapDefinition } from '../domain/congphap/congphap.validate';
import { DomainError } from '../domain/errors';

export class UpdateCongPhapUseCase {
  constructor(private readonly congphap: CongPhapRepository) {}
  async execute(def: CongPhapRecord): Promise<CongPhapRecord> {
    validateCongPhapDefinition(def);
    const ok = await this.congphap.update(def);
    if (!ok) throw new DomainError('CONGPHAP_NOT_FOUND', `Không tìm thấy công pháp "${def.id}"`);
    return def;
  }
}
