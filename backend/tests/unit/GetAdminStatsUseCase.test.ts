import { describe, it, expect } from 'vitest';
import { GetAdminStatsUseCase } from '../../src/application/GetAdminStatsUseCase';
import { InMemoryStatsRepository } from '../fakes/InMemoryStatsRepository';
import { StaticRealmConfigSource } from '../fakes/StaticRealmConfigSource';

describe('GetAdminStatsUseCase', () => {
  it('aggregates counts and maps realmMajor to the configured realm name, sorted ascending', async () => {
    const stats = new InMemoryStatsRepository();
    stats.users = 10;
    stats.admins = 2;
    stats.punished = 3;
    // Deliberately out of order — the use case must sort by realmMajor.
    stats.byRealm = [
      { realmMajor: 1, count: 4 },
      { realmMajor: 0, count: 6 },
    ];
    const useCase = new GetAdminStatsUseCase(stats, new StaticRealmConfigSource());

    const result = await useCase.execute();

    expect(result.totalUsers).toBe(10);
    expect(result.totalAdmins).toBe(2);
    expect(result.punishedCount).toBe(3);
    expect(result.realmDistribution).toEqual([
      { realmMajor: 0, realmName: 'Phàm Nhân', count: 6 },
      { realmMajor: 1, realmName: 'Luyện Khí', count: 4 },
    ]);
  });

  it('labels a realm missing from config as "Realm #N" instead of throwing', async () => {
    const stats = new InMemoryStatsRepository();
    // Seed config has 12 realms (majors 0..11) — 99 is out of range, as after
    // an admin deletes realms while characters still sit in them.
    stats.byRealm = [{ realmMajor: 99, count: 1 }];
    const useCase = new GetAdminStatsUseCase(stats, new StaticRealmConfigSource());

    const result = await useCase.execute();

    expect(result.realmDistribution).toEqual([{ realmMajor: 99, realmName: 'Realm #99', count: 1 }]);
  });

  it('passes the provided now to countPunished', async () => {
    const stats = new InMemoryStatsRepository();
    const useCase = new GetAdminStatsUseCase(stats, new StaticRealmConfigSource());
    const now = new Date('2026-07-19T00:00:00Z');

    await useCase.execute(now);

    expect(stats.lastPunishedNow).toEqual(now);
  });
});
