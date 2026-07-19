import { RealmConfigRepository } from '../../src/domain/ports/RealmConfigRepository';
import { SubStageRow } from '../../src/domain/config/realms';

export class InMemoryRealmConfigRepository implements RealmConfigRepository {
  private rows: SubStageRow[];
  constructor(initial: SubStageRow[] = []) {
    this.rows = [...initial];
  }
  async loadAll(): Promise<SubStageRow[]> {
    return [...this.rows].sort((a, b) => a.realmMajor - b.realmMajor || a.realmSub - b.realmSub);
  }
  async replaceAll(rows: SubStageRow[]): Promise<void> {
    this.rows = [...rows];
  }
}
