import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CongPhapRecord } from '../domain/congphap/congphap';

export class ListCongPhapAdminUseCase {
  constructor(private readonly congphap: CongPhapRepository) {}
  async execute(): Promise<CongPhapRecord[]> {
    return this.congphap.listAll();
  }
}
