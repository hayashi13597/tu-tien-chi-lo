import { AttributeSet, ATTRIBUTE_KEYS, BATTLE_POWER_WEIGHTS } from './attributes';

// Key hiệu ứng: thuộc tính chiến đấu (AttributeSet) HOẶC hai key hệ thống của
// Phase 2 — 'linhKhiRate' (% tốc độ tu luyện) và 'danDaoSuccess' (điểm % luyện đan).
// Key hệ thống không đi qua computeAttributes; chúng được gom bởi sumSystemBuffs.
export type EffectAttribute = keyof AttributeSet | 'linhKhiRate' | 'danDaoSuccess';

// Một hiệu ứng bị động: cộng flatPerLevel*level (phẳng) và pctPerLevel*level (%).
export interface PassiveEffect {
  attribute: EffectAttribute;
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
      // Key hệ thống (linhKhiRate/danDaoSuccess) không thuộc AttributeSet — lờ ở đây.
      if (!ATTRIBUTE_KEYS.includes(e.attribute as keyof AttributeSet)) continue;
      const attr = e.attribute as keyof AttributeSet;
      flat[attr] += e.flatPerLevel * p.level;
      pct[attr] += e.pctPerLevel * p.level;
    }
  }

  const final: AttributeSet = { ...base };
  for (const k of ATTRIBUTE_KEYS) {
    final[k] = (base[k] + flat[k]) * (1 + pct[k] / 100);
  }
  return { base: { ...base }, final };
}

// Buff hệ thống từ công pháp bị động (Phase 2). Điểm tiêu thụ:
// - linhKhiRatePct: điểm % cộng dồn, area tiêu thụ nhân cultivationRate × (1 + pct/100).
// - danDaoSuccessPct: điểm % cộng vào computeSuccessPct luyện đan (clamp 5..95 có sẵn).
export interface SystemBuffs {
  linhKhiRatePct: number;
  danDaoSuccessPct: number;
}

export function sumSystemBuffs(passives: OwnedPassive[]): SystemBuffs {
  let linhKhiRatePct = 0;
  let danDaoSuccessPct = 0;
  for (const p of passives) {
    for (const e of p.effects) {
      if (e.attribute === 'linhKhiRate') linhKhiRatePct += e.pctPerLevel * p.level;
      else if (e.attribute === 'danDaoSuccess') danDaoSuccessPct += e.pctPerLevel * p.level;
    }
  }
  return { linhKhiRatePct, danDaoSuccessPct };
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
