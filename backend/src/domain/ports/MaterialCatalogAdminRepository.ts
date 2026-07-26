import { MaterialRecord } from '../materials/material';

export interface MaterialCatalogAdminRepository {
  list(): Promise<MaterialRecord[]>;
  replace(rows: readonly MaterialRecord[]): Promise<MaterialRecord[]>;
}
