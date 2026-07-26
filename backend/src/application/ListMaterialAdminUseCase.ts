import { MaterialCatalogAdminRepository } from '../domain/ports/MaterialCatalogAdminRepository';
import { MaterialRecord } from '../domain/materials/material';

export class ListMaterialAdminUseCase {
  constructor(private readonly repo: MaterialCatalogAdminRepository) {}
  async execute(): Promise<MaterialRecord[]> { return this.repo.list(); }
}
