export interface CharacterRecord {
  id: string;
  userId: string;
  realmMajor: number;
  realmSub: number;
  linhKhi: number;
  lastUpdateAt: Date;
  breakthroughFails: number;
  punishedUntil: Date | null;
  createdAt: Date;
}
