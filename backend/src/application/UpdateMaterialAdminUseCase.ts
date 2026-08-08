import { DomainError } from '../domain/errors';
import { MaterialCatalogAdminRepository } from '../domain/ports/MaterialCatalogAdminRepository';
import { MaterialRecord } from '../domain/materials/material';

export class UpdateMaterialAdminUseCase {
  constructor(private readonly repo: MaterialCatalogAdminRepository) {}

  async execute(rows: readonly MaterialRecord[]): Promise<MaterialRecord[]> {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row.id || ids.has(row.id) || row.rarity < 0 || !Number.isInteger(row.tier) || row.tier < 1 || row.tier > 3 ||
          !row.name || !row.glyph || !row.description) {
        throw new DomainError('INVALID_MATERIAL_CONFIG', 'material catalog contains an invalid or duplicate row');
      }
      ids.add(row.id);
    }
    return this.repo.replace(rows);
  }
}
