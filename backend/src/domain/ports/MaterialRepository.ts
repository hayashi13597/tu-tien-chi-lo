import { MaterialInventoryRecord, MaterialRecord, MaterialSpendLine } from '../materials/material';

export interface MaterialRepository {
  listInventory(userId: string): Promise<MaterialInventoryRecord[]>;
  getById(materialId: string): Promise<MaterialRecord | null>;
  increment(userId: string, materialId: string, quantity: number): Promise<void>;
  spendMany(userId: string, lines: readonly MaterialSpendLine[]): Promise<boolean>;
}
