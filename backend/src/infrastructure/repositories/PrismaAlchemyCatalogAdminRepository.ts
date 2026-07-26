import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../domain/errors';
import { AlchemyCatalogAdminRepository } from '../../domain/ports/AlchemyCatalogAdminRepository';
import { AlchemyRecipeRecord } from '../../domain/alchemy/alchemy';

export class PrismaAlchemyCatalogAdminRepository implements AlchemyCatalogAdminRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(): Promise<AlchemyRecipeRecord[]> {
    const rows = await this.client.alchemyRecipe.findMany({ include: { ingredients: true }, orderBy: { id: 'asc' } });
    return rows.map((row) => ({
      id: row.id, pillId: row.pillId, durationSec: row.durationSec, linhThachCost: row.linhThachCost, active: row.active,
      ingredients: row.ingredients.map((ingredient) => ({ materialId: ingredient.materialId, quantity: ingredient.quantity })),
    }));
  }

  async replace(rows: readonly AlchemyRecipeRecord[]): Promise<AlchemyRecipeRecord[]> {
    await this.client.$transaction(async (tx) => {
      for (const row of rows) {
        if (!await tx.pill.findUnique({ where: { id: row.pillId }, select: { id: true } })) {
          throw new DomainError('PILL_NOT_FOUND', `pill not found: ${row.pillId}`);
        }
        for (const ingredient of row.ingredients) {
          if (!await tx.material.findUnique({ where: { id: ingredient.materialId }, select: { id: true } })) {
            throw new DomainError('MATERIAL_NOT_FOUND', `material not found: ${ingredient.materialId}`);
          }
        }
        await tx.alchemyRecipe.upsert({
          where: { id: row.id },
          create: { id: row.id, pillId: row.pillId, durationSec: row.durationSec, linhThachCost: row.linhThachCost, active: row.active },
          update: { pillId: row.pillId, durationSec: row.durationSec, linhThachCost: row.linhThachCost, active: row.active },
        });
        await tx.alchemyRecipeIngredient.deleteMany({ where: { recipeId: row.id } });
        await tx.alchemyRecipeIngredient.createMany({ data: row.ingredients.map((ingredient) => ({ recipeId: row.id, materialId: ingredient.materialId, quantity: ingredient.quantity })) });
      }
    });
    return this.list();
  }
}
