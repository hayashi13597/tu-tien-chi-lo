import { PrismaClient } from '@prisma/client';
import { RealmConfigRepository } from '../../domain/ports/RealmConfigRepository';
import { SubStageRow } from '../../domain/config/realms';

export class PrismaRealmConfigRepository implements RealmConfigRepository {
  constructor(private readonly client: PrismaClient) {}

  async loadAll(): Promise<SubStageRow[]> {
    const rows = await this.client.realmStage.findMany({
      orderBy: [{ realmMajor: 'asc' }, { realmSub: 'asc' }],
    });
    // Drop the surrogate `id`; the domain row is keyed by (realmMajor, realmSub).
    return rows.map(({ id: _id, ...rest }) => rest);
  }

  async replaceAll(rows: SubStageRow[]): Promise<void> {
    // Single transaction: wipe then re-insert. An admin's new config replaces the
    // old one atomically — a reader can never observe a partially-written config.
    await this.client.$transaction([
      this.client.realmStage.deleteMany(),
      this.client.realmStage.createMany({ data: rows }),
    ]);
  }
}
