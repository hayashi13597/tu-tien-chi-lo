import { ExpeditionRepository } from '../domain/ports/ExpeditionRepository';
import { ClaimExpeditionOutput } from '../domain/expedition/expedition';

export class ClaimExpeditionUseCase {
  constructor(private readonly expeditions: ExpeditionRepository) {}

  async execute(userId: string, now = new Date()): Promise<ClaimExpeditionOutput> {
    return this.expeditions.claim(userId, now);
  }
}
