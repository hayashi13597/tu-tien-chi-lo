import { AttributeSet, ATTRIBUTE_KEYS, BATTLE_POWER_WEIGHTS } from './attributes';

// Một hiệu ứng bị động: cộng flatPerLevel*level (phẳng) và pctPerLevel*level (%).
export interface PassiveEffect {
  attribute: keyof AttributeSet;
  flatPerLevel: number;
  pctPerLevel: number;
}

// Công pháp bị động đang sở hữu, rút gọn cho phép tính (chỉ cần effects + level).
export interface OwnedPassive {
  level: number;
  effects: PassiveEffect[];
}

// Tổng hợp thuộc tính cuối từ base (cảnh giới) + các công pháp bị động.
// Quy tắc: final = (base + Σ flat) × (1 + Σ pct/100) — cộng phẳng TRƯỚC, nhân %
// SAU (chuẩn game tu tiên: % là "phần trăm tổng sau khi đã cộng nền + trang bị").
export function computeAttributes(
  base: AttributeSet,
  passives: OwnedPassive[],
): { base: AttributeSet; final: AttributeSet } {
  const flat: AttributeSet = { khiHuyet: 0, chanNguyen: 0, congVatLy: 0, congPhep: 0, phongThu: 0, tocDo: 0 };
  const pct: AttributeSet = { khiHuyet: 0, chanNguyen: 0, congVatLy: 0, congPhep: 0, phongThu: 0, tocDo: 0 };

  for (const p of passives) {
    for (const e of p.effects) {
      flat[e.attribute] += e.flatPerLevel * p.level;
      pct[e.attribute] += e.pctPerLevel * p.level;
    }
  }

  const final: AttributeSet = { ...base };
  for (const k of ATTRIBUTE_KEYS) {
    final[k] = (base[k] + flat[k]) * (1 + pct[k] / 100);
  }
  return { base: { ...base }, final };
}

// Chiến lực = tổng trọng số 6 thuộc tính cuối, làm tròn. Công pháp chủ động KHÔNG
// tham gia (hiệu ứng của chúng là sát thương combat, để dành phase sau).
export function computeBattlePower(
  final: AttributeSet,
  weights: AttributeSet = BATTLE_POWER_WEIGHTS,
): number {
  let sum = 0;
  for (const k of ATTRIBUTE_KEYS) sum += final[k] * weights[k];
  return Math.round(sum);
}
