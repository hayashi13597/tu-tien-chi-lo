import { RealmConfigRepository } from '../domain/ports/RealmConfigRepository';
import { RealmConfig, flattenRealms } from '../domain/config/realms';
import { DomainError } from '../domain/errors';

// Validates + atomically replaces the realm config. zod (presentation) already
// guarantees field types/ranges and array min-lengths; this use case enforces the
// cross-cutting business invariants zod can't express, then delegates the atomic
// swap to the repository.
export class UpdateRealmConfigUseCase {
  constructor(private readonly repo: RealmConfigRepository) {}

  async execute(realms: RealmConfig[]): Promise<RealmConfig[]> {
    if (realms.length === 0) {
      throw new DomainError('INVALID_REALM_CONFIG', 'At least one realm is required');
    }
    for (const realm of realms) {
      if (realm.subStages.length === 0) {
        throw new DomainError('INVALID_REALM_CONFIG', `Realm "${realm.name}" has no sub-stages`);
      }
    }

    // linhKhiRequired must strictly increase across the whole progression (flat
    // major→sub order) — the monotonic invariant the accrual/breakthrough loop
    // relies on. Nested arrays already give contiguous indices, so no gap check
    // is needed here.
    const rows = flattenRealms(realms);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].linhKhiRequired <= rows[i - 1].linhKhiRequired) {
        throw new DomainError(
          'INVALID_REALM_CONFIG',
          `linhKhiRequired must strictly increase (violation at realm ${rows[i].realmMajor}, sub ${rows[i].realmSub})`,
        );
      }
    }

    await this.repo.replaceAll(rows);
    return realms;
  }
}
