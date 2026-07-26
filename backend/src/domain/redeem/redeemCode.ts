export interface RewardEntry {
  // Đúng một trong ba khác undefined.
  pillId?: string;
  congPhapId?: string;
  linhThach?: number;
  quantity: number;
}

export interface RedeemCodeRecord {
  id: string;
  code: string;
  active: boolean;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: Date | null;
  rewards: RewardEntry[];
}

export interface RedeemRewardResult {
  kind: 'pill' | 'congphap' | 'linhThach';
  id: string;        // pillId / congPhapId / 'linh-thach'
  name: string;
  glyph: string;
  quantity: number;
}

export interface RedeemResultDto {
  rewards: RedeemRewardResult[];
}
