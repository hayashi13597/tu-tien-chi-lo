export interface RewardEntry {
  // Đúng một trong bốn khác undefined.
  pillId?: string;
  congPhapId?: string;
  linhThach?: number;
  materialId?: string;
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
  kind: 'pill' | 'congphap' | 'linhThach' | 'material';
  id: string;        // pillId / congPhapId / 'linh-thach'
  name: string;
  glyph: string;
  quantity: number;
}

export interface RedeemResultDto {
  rewards: RedeemRewardResult[];
}
