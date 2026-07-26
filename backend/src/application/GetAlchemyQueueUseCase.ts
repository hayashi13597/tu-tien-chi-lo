import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { AlchemyQueueOutput } from '../domain/alchemy/alchemy';

export class GetAlchemyQueueUseCase {
  constructor(private readonly alchemy: AlchemyRepository) {}

  async execute(userId: string, now = new Date()): Promise<AlchemyQueueOutput> {
    return this.alchemy.settleCompleted(userId, now);
  }
}
