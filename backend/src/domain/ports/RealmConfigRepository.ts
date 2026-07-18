import { SubStageRow } from '../config/realms';

export interface RealmConfigRepository {
  // All sub-stage rows, ordered by (realmMajor, realmSub).
  loadAll(): Promise<SubStageRow[]>;
  // Replace the entire config atomically (delete-all + insert-all in one
  // transaction), so a partial write can never leave a half-applied config.
  replaceAll(rows: SubStageRow[]): Promise<void>;
}
