import { ExpeditionRepository } from '../domain/ports/ExpeditionRepository';
import { CurrentExpeditionOutput } from '../domain/expedition/expedition';

export class GetCurrentExpeditionUseCase {
  constructor(private readonly expeditions: ExpeditionRepository) {}

  async execute(userId: string, now = new Date()): Promise<CurrentExpeditionOutput> {
    return this.expeditions.getCurrent(userId, now);
  }
}
