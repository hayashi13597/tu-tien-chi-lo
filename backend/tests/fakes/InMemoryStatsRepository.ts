import { StatsRepository, RealmCount } from '../../src/domain/ports/StatsRepository';

export class InMemoryStatsRepository implements StatsRepository {
  users = 0;
  admins = 0;
  byRealm: RealmCount[] = [];
  punished = 0;
  /** Captured for assertions: the `now` the use case passed in. */
  lastPunishedNow: Date | null = null;

  async countUsers(): Promise<number> {
    return this.users;
  }

  async countAdmins(): Promise<number> {
    return this.admins;
  }

  async countCharactersByRealm(): Promise<RealmCount[]> {
    return this.byRealm;
  }

  async countPunished(now: Date): Promise<number> {
    this.lastPunishedNow = now;
    return this.punished;
  }
}
