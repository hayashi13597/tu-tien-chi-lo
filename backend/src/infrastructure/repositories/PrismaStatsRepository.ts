import { PrismaClient } from '@prisma/client';
import { StatsRepository, RealmCount } from '../../domain/ports/StatsRepository';

export class PrismaStatsRepository implements StatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  countUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  countAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'admin' } });
  }

  async countCharactersByRealm(): Promise<RealmCount[]> {
    const groups = await this.prisma.character.groupBy({
      by: ['realmMajor'],
      _count: { _all: true },
    });
    return groups.map((g) => ({ realmMajor: g.realmMajor, count: g._count._all }));
  }

  countPunished(now: Date): Promise<number> {
    // gt on a nullable DateTime: NULL (never punished) rows never match.
    return this.prisma.character.count({ where: { punishedUntil: { gt: now } } });
  }
}
