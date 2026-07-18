import { describe, it, expect } from 'vitest';
import { UpdateRealmConfigUseCase } from '../../src/application/UpdateRealmConfigUseCase';
import { InMemoryRealmConfigRepository } from '../fakes/InMemoryRealmConfigRepository';
import { RealmConfig } from '../../src/domain/config/realms';
import { DomainError } from '../../src/domain/errors';

function stage(name: string, linhKhiRequired: number) {
  return { name, linhKhiRequired, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 };
}

const valid: RealmConfig[] = [
  { name: 'A', subStages: [stage('A0', 100), stage('A1', 200)] },
  { name: 'B', subStages: [stage('B0', 300)] },
];

describe('UpdateRealmConfigUseCase', () => {
  it('persists a valid config and returns it', async () => {
    const repo = new InMemoryRealmConfigRepository();
    const result = await new UpdateRealmConfigUseCase(repo).execute(valid);
    expect(result).toEqual(valid);
    const rows = await repo.loadAll();
    expect(rows).toHaveLength(3);
    expect(rows[2].realmName).toBe('B');
  });

  it('allows linhKhiRequired to reset lower at a new realm boundary', async () => {
    // The real balance resets to a lower requirement at each new realm (e.g.
    // Phàm Nhân peak 500 → Luyện Khí start 300); monotonicity is per-realm only.
    const resetting: RealmConfig[] = [
      { name: 'A', subStages: [stage('A0', 100), stage('A1', 500)] },
      { name: 'B', subStages: [stage('B0', 300), stage('B1', 600)] },
    ];
    const repo = new InMemoryRealmConfigRepository();
    const result = await new UpdateRealmConfigUseCase(repo).execute(resetting);
    expect(result).toEqual(resetting);
  });

  it('rejects a non-increasing linhKhiRequired within a realm', async () => {
    const bad: RealmConfig[] = [
      { name: 'A', subStages: [stage('A0', 200), stage('A1', 150)] },
    ];
    await expect(new UpdateRealmConfigUseCase(new InMemoryRealmConfigRepository()).execute(bad))
      .rejects.toMatchObject({ code: 'INVALID_REALM_CONFIG' });
  });

  it('rejects an empty realm list', async () => {
    await expect(new UpdateRealmConfigUseCase(new InMemoryRealmConfigRepository()).execute([]))
      .rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a realm with no sub-stages', async () => {
    const bad: RealmConfig[] = [{ name: 'A', subStages: [] }];
    await expect(new UpdateRealmConfigUseCase(new InMemoryRealmConfigRepository()).execute(bad))
      .rejects.toMatchObject({ code: 'INVALID_REALM_CONFIG' });
  });
});
