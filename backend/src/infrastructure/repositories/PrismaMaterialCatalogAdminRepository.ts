import { PrismaClient } from '@prisma/client';
import { MaterialCatalogAdminRepository } from '../../domain/ports/MaterialCatalogAdminRepository';
import { MaterialRecord } from '../../domain/materials/material';

export class PrismaMaterialCatalogAdminRepository implements MaterialCatalogAdminRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(): Promise<MaterialRecord[]> {
    return this.client.material.findMany({ orderBy: { id: 'asc' } });
  }

  async replace(rows: readonly MaterialRecord[]): Promise<MaterialRecord[]> {
    await this.client.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.material.upsert({ where: { id: row.id }, create: row, update: row });
      }
    });
    return this.list();
  }
}
