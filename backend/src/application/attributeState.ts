import { AttributeSet } from '../domain/attributes/attributes';
import { computeAttributes, computeBattlePower, sumSystemBuffs, SystemBuffs } from '../domain/attributes/attributes.calc';
import { RealmConfigSet } from '../domain/config/realms';
import { OwnedCongPhapEntry } from '../domain/congphap/congphap';

export interface AttributeStateOutput {
  attributes: { base: AttributeSet; final: AttributeSet };
  battlePower: number;
}

// Dựng thuộc tính hiển thị từ base cảnh giới + công pháp bị động đang sở hữu.
// Chỉ passive VÀ def.active mới đóng góp; công pháp chủ động bị bỏ qua (hiệu ứng
// của chúng để dành phase combat). Dùng chung bởi cả 3 use case trả cultivation state.
export function buildAttributeState(
  config: RealmConfigSet,
  realmMajor: number,
  realmSub: number,
  owned: OwnedCongPhapEntry[],
): AttributeStateOutput {
  const base = config.baseAttributes(realmMajor, realmSub);
  const passives = owned
    .filter((o) => o.def.category === 'passive' && o.def.active && o.def.effects)
    .map((o) => ({ level: o.level, effects: o.def.effects! }));
  const { base: b, final } = computeAttributes(base, passives);
  return { attributes: { base: b, final }, battlePower: computeBattlePower(final) };
}

// Buff hệ thống từ passive đang sở hữu (Phase 2) — cùng filter với buildAttributeState
// (chỉ passive + def.active). Kèm multiplier tính sẵn để call-site nhân thẳng vào
// cultivationRate; danDaoSuccessPct truyền nguyên vào computeSuccessPct.
export function buildSystemBuffs(owned: OwnedCongPhapEntry[]): SystemBuffs & { linhKhiRateMultiplier: number } {
  const passives = owned
    .filter((o) => o.def.category === 'passive' && o.def.active && o.def.effects)
    .map((o) => ({ level: o.level, effects: o.def.effects! }));
  const buffs = sumSystemBuffs(passives);
  return { ...buffs, linhKhiRateMultiplier: 1 + buffs.linhKhiRatePct / 100 };
}
