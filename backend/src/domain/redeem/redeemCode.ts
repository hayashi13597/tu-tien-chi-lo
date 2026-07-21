export interface RewardEntry {
  pillId: string;
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

export interface RedeemResultDto {
  rewards: Array<{ pillId: string; name: string; glyph: string; quantity: number }>;
}
