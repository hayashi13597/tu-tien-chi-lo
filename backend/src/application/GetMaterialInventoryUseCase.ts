import { MaterialRepository } from '../domain/ports/MaterialRepository';
import { MaterialInventoryRecord } from '../domain/materials/material';

export class GetMaterialInventoryUseCase {
  constructor(private readonly materials: MaterialRepository) {}

  async execute(userId: string): Promise<MaterialInventoryRecord[]> {
    const inventory = await this.materials.listInventory(userId);
    return inventory.filter((entry) => entry.quantity > 0 && entry.material?.active !== false);
  }
}
