import { describe, it, expect } from 'vitest';
import { RealmConfigProvider } from '../../src/infrastructure/config/RealmConfigProvider';
import { InMemoryRealmConfigRepository } from '../fakes/InMemoryRealmConfigRepository';
import { SubStageRow } from '../../src/domain/config/realms';

const rowA: SubStageRow = { realmMajor: 0, realmSub: 0, realmName: 'A', subStageName: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 };
const rowB: SubStageRow = { ...rowA, realmName: 'B', subStageName: 'B0', linhKhiRequired: 999 };

describe('RealmConfigProvider', () => {
  it('get() throws before ensureLoaded()', () => {
    const provider = new RealmConfigProvider(new InMemoryRealmConfigRepository([rowA]));
    expect(() => provider.get()).toThrow();
  });

  it('serves the loaded config synchronously after ensureLoaded()', async () => {
    const provider = new RealmConfigProvider(new InMemoryRealmConfigRepository([rowA]));
    await provider.ensureLoaded();
    expect(provider.get().getStage(0, 0).linhKhiRequired).toBe(100);
  });

  it('reload() picks up a changed config', async () => {
    const repo = new InMemoryRealmConfigRepository([rowA]);
    const provider = new RealmConfigProvider(repo);
    await provider.ensureLoaded();
    await repo.replaceAll([rowB]);
    await provider.reload();
    expect(provider.get().getStage(0, 0).linhKhiRequired).toBe(999);
  });
});
