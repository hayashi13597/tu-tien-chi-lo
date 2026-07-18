import { StatsRepository } from '../domain/ports/StatsRepository';
import { RealmConfigSource } from '../domain/ports/RealmConfigSource';

export interface RealmDistributionEntry {
  realmMajor: number;
  realmName: string;
  count: number;
}

export interface AdminStatsOutput {
  totalUsers: number;
  totalAdmins: number;
  realmDistribution: RealmDistributionEntry[];
  punishedCount: number;
}

export class GetAdminStatsUseCase {
  constructor(
    private readonly stats: StatsRepository,
    private readonly realmConfig: RealmConfigSource,
  ) {}

  async execute(now: Date = new Date()): Promise<AdminStatsOutput> {
    const config = this.realmConfig.get();
    const [totalUsers, totalAdmins, byRealm, punishedCount] = await Promise.all([
      this.stats.countUsers(),
      this.stats.countAdmins(),
      this.stats.countCharactersByRealm(),
      this.stats.countPunished(now),
    ]);

    const realmDistribution = [...byRealm]
      .sort((a, b) => a.realmMajor - b.realmMajor)
      .map(({ realmMajor, count }) => ({
        realmMajor,
        // Characters can sit in a realm the admin has since deleted from the
        // config (free structural editing) — label it by index rather than
        // letting realmName() read past the config array.
        realmName:
          realmMajor >= 0 && realmMajor <= config.maxRealmMajor
            ? config.realmName(realmMajor)
            : `Realm #${realmMajor}`,
        count,
      }));

    return { totalUsers, totalAdmins, realmDistribution, punishedCount };
  }
}
