export interface RealmCount {
  realmMajor: number;
  count: number;
}

export interface StatsRepository {
  countUsers(): Promise<number>;
  countAdmins(): Promise<number>;
  countCharactersByRealm(): Promise<RealmCount[]>;
  countPunished(now: Date): Promise<number>;
}
