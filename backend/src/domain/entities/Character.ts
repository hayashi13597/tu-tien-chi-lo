export interface CharacterRecord {
  id: string;
  userId: string;
  realmMajor: number;
  realmSub: number;
  linhKhi: number;
  lastUpdateAt: Date;
  breakthroughFails: number;
  punishedUntil: Date | null;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
  createdAt: Date;
}
