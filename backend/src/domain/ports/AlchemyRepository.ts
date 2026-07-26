import { AlchemyJobRecord, AlchemyQueueOutput, AlchemyRecipeRecord } from '../alchemy/alchemy';

export interface AlchemyRepository {
  listRecipes(): Promise<AlchemyRecipeRecord[]>;
  listQueue(userId: string): Promise<AlchemyJobRecord[]>;
  enqueue(input: {
    userId: string;
    characterId: string;
    recipeId: string;
    quantity: number;
    now: Date;
  }): Promise<AlchemyQueueOutput>;
  settleCompleted(userId: string, now: Date): Promise<AlchemyQueueOutput>;
}
