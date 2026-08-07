import { AlchemyJobRecord, AlchemyQueueOutput, AlchemyRecipeRecord } from '../alchemy/alchemy';
import { AlchemyProfileRecord } from '../alchemy/alchemy.profile';

export interface AlchemyRepository {
  listRecipes(): Promise<AlchemyRecipeRecord[]>;
  listQueue(userId: string): Promise<AlchemyJobRecord[]>;
  // get-or-create: user cũ chưa có profile được tạo rank 1 trong lần gọi đầu.
  getProfile(userId: string): Promise<AlchemyProfileRecord>;
  enqueue(input: {
    userId: string;
    characterId: string;
    recipeId: string;
    quantity: number;
    now: Date;
  }): Promise<AlchemyQueueOutput>;
  settleCompleted(userId: string, now: Date): Promise<AlchemyQueueOutput>;
  // rankUp/upgradeFurnace trừ Đan Khí (+Linh Thạch) và bump level trong một
  // tx có guard (atomic với check đọc-trước của use case).
  rankUp(userId: string, targetRank: number, danKhiCost: number): Promise<AlchemyProfileRecord>;
  upgradeFurnace(input: {
    userId: string;
    characterId: string;
    targetLevel: number;
    danKhiCost: number;
    linhThachCost: number;
  }): Promise<AlchemyProfileRecord>;
}
