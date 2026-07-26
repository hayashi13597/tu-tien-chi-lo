import { CharacterRecord } from '../entities/Character';

export interface CharacterUpdateInput {
  realmMajor: number;
  realmSub: number;
  linhKhi: number;
  linhThach: number;
  lastUpdateAt: Date;
  breakthroughFails: number;
  punishedUntil: Date | null;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
}

export interface CharacterRepository {
  findByUserId(userId: string): Promise<CharacterRecord | null>;

  /**
   * Updates a Character row only if its lastUpdateAt still equals
   * expectedLastUpdateAt (optimistic concurrency guard). Returns the updated
   * record on success, or null if no row matched — meaning another request
   * already wrote to this character first.
   */
  updateWithConcurrencyGuard(
    id: string,
    expectedLastUpdateAt: Date,
    data: CharacterUpdateInput,
  ): Promise<CharacterRecord | null>;

  /** Atomic: trừ `amount` Linh Thạch guard trên số dư đủ (linhThach >= amount).
   *  Trả false nếu không đủ hoặc không có character — không bao giờ để âm. */
  spendLinhThach(characterId: string, amount: number): Promise<boolean>;
  /** Cộng `amount` Linh Thạch (grant / hoàn khi saga bù). Không guard. */
  addLinhThach(characterId: string, amount: number): Promise<void>;
}
