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

    // linhKhiRequired must strictly increase within each realm (Sơ Kỳ → Viên
    // Mãn) — the monotonic invariant a realm's progression relies on. It does NOT
    // increase across realm boundaries: the seed resets to a lower value at each
    // new realm (e.g. Phàm Nhân peak 500 → Luyện Khí start 300), so the check is
    // per-realm, not across the flat order.
    for (const realm of realms) {
      for (let i = 1; i < realm.subStages.length; i++) {
        if (realm.subStages[i].linhKhiRequired <= realm.subStages[i - 1].linhKhiRequired) {
          throw new DomainError(
            'INVALID_REALM_CONFIG',
            `linhKhiRequired must strictly increase within realm "${realm.name}" (violation at sub-stage ${i})`,
          );
        }
      }
    }

    const rows = flattenRealms(realms);
    await this.repo.replaceAll(rows);
    return realms;
  }
}
