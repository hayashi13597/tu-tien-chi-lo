import { ATTRIBUTE_KEYS } from '../attributes/attributes';
import { DomainError } from '../errors';
import { PillRecord } from '../pills/pill';
import { LoadoutEntry } from './expedition';

const TRIGGERS = new Set(['start', 'lowHp30']);

// Phase 3 — loadout đan combat cho bí cảnh: tối đa 2 slot, chỉ đan combatBuff
// còn active; field đủ và đúng tập cho phép. Trả entries chuẩn hóa để snapshot.
export function validateLoadout(pills: readonly PillRecord[]): LoadoutEntry[] {
  if (pills.length > 2) throw new DomainError('LOADOUT_INVALID', 'Loadout tối đa 2 đan');
  const seen = new Set<string>();
  return pills.map((pill) => {
    if (seen.has(pill.id)) throw new DomainError('LOADOUT_INVALID', 'Không thể mang hai viên cùng loại');
    seen.add(pill.id);
    if (!pill.active || pill.effectKind !== 'combatBuff') {
      throw new DomainError('LOADOUT_INVALID', `Đan không dùng được cho bí cảnh: ${pill.id}`);
    }
    if (!(pill.bonusPct !== null && pill.bonusPct > 0)) {
      throw new DomainError('LOADOUT_INVALID', `Đan ${pill.id} thiếu bonusPct`);
    }
    if (!pill.combatAttribute || !ATTRIBUTE_KEYS.includes(pill.combatAttribute)) {
      throw new DomainError('LOADOUT_INVALID', `Đan ${pill.id} combatAttribute không hợp lệ`);
    }
    if (!pill.combatTrigger || !TRIGGERS.has(pill.combatTrigger)) {
      throw new DomainError('LOADOUT_INVALID', `Đan ${pill.id} combatTrigger không hợp lệ`);
    }
    return { pillId: pill.id, combatAttribute: pill.combatAttribute, combatTrigger: pill.combatTrigger, pct: pill.bonusPct };
  });
}
