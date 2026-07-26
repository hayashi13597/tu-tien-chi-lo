export interface CharacterRecord {
  id: string;
  userId: string;
  realmMajor: number;
  realmSub: number;
  linhKhi: number;
  // Currency dùng để nâng cấp công pháp. Cấp qua redeem code + admin.
  linhThach: number;
  lastUpdateAt: Date;
  breakthroughFails: number;
  punishedUntil: Date | null;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
  createdAt: Date;
}
