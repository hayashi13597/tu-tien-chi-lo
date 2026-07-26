import { DomainError } from '../domain/errors';
import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { MaterialRepository } from '../domain/ports/MaterialRepository';
import { AlchemyQueueOutput } from '../domain/alchemy/alchemy';
import { reserveRecipeInput, validateRecipe } from '../domain/alchemy/alchemy.calc';
import { canSpendMaterials } from '../domain/materials/material.calc';

export class QueueAlchemyUseCase {
  constructor(
    private readonly alchemy: AlchemyRepository,
    private readonly materials: MaterialRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(userId: string, recipeId: string, quantity: number, now = new Date()): Promise<AlchemyQueueOutput> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError('ALCHEMY_QUEUE_INVALID', 'alchemy quantity must be a positive integer');
    }

    const recipe = (await this.alchemy.listRecipes()).find((item) => item.id === recipeId);
    if (!recipe) {
      throw new DomainError('ALCHEMY_RECIPE_NOT_FOUND', `recipe not found: ${recipeId}`);
    }
    if (!recipe.active) {
      throw new DomainError('ALCHEMY_QUEUE_INVALID', `recipe is inactive: ${recipeId}`);
    }
    try {
      validateRecipe(recipe);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new DomainError('ALCHEMY_QUEUE_INVALID', error.message);
      }
      throw error;
    }

    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);
    }
    const materialLines = reserveRecipeInput(recipe, quantity);
    const inventory = await this.materials.listInventory(userId);
    const balance = new Map(inventory.map((entry) => [entry.materialId, entry.quantity]));
    if (!canSpendMaterials(balance, materialLines)) {
      throw new DomainError('INSUFFICIENT_MATERIALS', 'not enough alchemy materials');
    }
    const linhThachCost = recipe.linhThachCost * quantity;
    if (character.linhThach < linhThachCost) {
      throw new DomainError('INSUFFICIENT_LINH_THACH', 'not enough Linh Thạch');
    }

    // The preflight checks make errors immediate for the player. The repository
    // repeats both guards inside one transaction, so concurrent enqueue requests
    // cannot partially spend either resource.
    return this.alchemy.enqueue({ userId, characterId: character.id, recipeId, quantity, now });
  }
}
