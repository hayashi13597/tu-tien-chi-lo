import { PillRepository } from '../domain/ports/PillRepository';
import { PillEffectKind } from '../domain/pills/pill';

export interface InventoryDto {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
  quantity: number;
}

export class GetInventoryUseCase {
  constructor(private readonly pills: PillRepository) {}

  async execute(userId: string): Promise<InventoryDto[]> {
    const entries = await this.pills.listInventory(userId);
    return entries.map((e) => ({
      id: e.pill.id,
      name: e.pill.name,
      glyph: e.pill.glyph,
      rarity: e.pill.rarity,
      effectKind: e.pill.effectKind,
      amount: e.pill.amount,
      multiplier: e.pill.multiplier,
      durationSec: e.pill.durationSec,
      bonusPct: e.pill.bonusPct,
      desc: e.pill.desc,
      quantity: e.quantity,
    }));
  }
}
