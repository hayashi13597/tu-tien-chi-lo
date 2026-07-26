import { PrismaClient } from '@prisma/client';
import { CharacterRepository, CharacterUpdateInput } from '../../domain/ports/CharacterRepository';
import { CharacterRecord } from '../../domain/entities/Character';

export class PrismaCharacterRepository implements CharacterRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByUserId(userId: string): Promise<CharacterRecord | null> {
    return this.client.character.findUnique({ where: { userId } });
  }

  async updateWithConcurrencyGuard(
    id: string,
    expectedLastUpdateAt: Date,
    data: CharacterUpdateInput,
  ): Promise<CharacterRecord | null> {
    // updateMany scoped to id + the lastUpdateAt read at the top of the caller's
    // request: if another request already wrote first, the row's lastUpdateAt
    // no longer matches expectedLastUpdateAt and count is 0 — no row is touched.
    const result = await this.client.character.updateMany({
      where: { id, lastUpdateAt: expectedLastUpdateAt },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.client.character.findUniqueOrThrow({ where: { id } });
  }

  async spendLinhThach(characterId: string, amount: number): Promise<boolean> {
    // Row-level atomic guard: chỉ trừ khi số dư >= amount => không bao giờ âm,
    // hai lần nâng cấp song song không cùng tiêu quá số dư.
    const res = await this.client.character.updateMany({
      where: { id: characterId, linhThach: { gte: amount } },
      data: { linhThach: { decrement: amount } },
    });
    return res.count === 1;
  }

  async addLinhThach(characterId: string, amount: number): Promise<void> {
    await this.client.character.updateMany({ where: { id: characterId }, data: { linhThach: { increment: amount } } });
  }
}
