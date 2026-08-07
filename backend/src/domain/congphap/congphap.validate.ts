import { CongPhapRecord } from './congphap';
import { ATTRIBUTE_KEYS, AttributeSet } from '../attributes/attributes';
import { DomainError } from '../errors';

const SLUG = /^[a-z0-9-]+$/;
const SYSTEM_EFFECT_KEYS = ['linhKhiRate', 'danDaoSuccess'] as const;
const BRANCHES = ['tuLuyen', 'chienDao', 'danDao'] as const;

function fail(message: string): never {
  throw new DomainError('INVALID_CONGPHAP_CONFIG', message);
}

// Bất biến nghiệp vụ zod (presentation) không diễn đạt được vì phụ thuộc category.
// Nguồn duy nhất định nghĩa "một công pháp hợp lệ".
export function validateCongPhapDefinition(def: CongPhapRecord): void {
  if (!SLUG.test(def.id)) fail('id must match ^[a-z0-9-]+$');
  if (def.name.trim() === '') fail('name must not be empty');
  if (def.glyph.trim() === '') fail('glyph must not be empty');
  if (def.desc.trim() === '') fail('desc must not be empty');
  if (!Number.isFinite(def.rarity)) fail('rarity must be a number');
  if (!Number.isInteger(def.maxLevel) || def.maxLevel < 1) fail('maxLevel must be an integer >= 1');
  if (!Number.isInteger(def.baseCost) || def.baseCost < 0) fail('baseCost must be an integer >= 0');
  if (!(def.costGrowth >= 1)) fail('costGrowth must be >= 1');
  if (def.dupRefundLinhThach !== null && (!Number.isInteger(def.dupRefundLinhThach) || def.dupRefundLinhThach < 0)) {
    fail('dupRefundLinhThach must be null or an integer >= 0');
  }

  if (def.category === 'passive') {
    if (def.powerPerLevel !== null) fail('passive công pháp must not set powerPerLevel');
    if (def.chanNguyenCost !== null) fail('passive công pháp must not set chanNguyenCost');
    if (!def.effects || def.effects.length === 0) fail('passive công pháp requires at least one effect');
    for (const e of def.effects) {
      // Key thuộc AttributeSet (chiến đấu) hoặc hai key hệ thống của Phase 2.
      const isSystemKey = (SYSTEM_EFFECT_KEYS as readonly string[]).includes(e.attribute);
      const isAttributeKey = ATTRIBUTE_KEYS.includes(e.attribute as keyof AttributeSet);
      if (!isSystemKey && !isAttributeKey) fail(`unknown attribute "${e.attribute}"`);
      if (!Number.isFinite(e.flatPerLevel) || !Number.isFinite(e.pctPerLevel)) fail('effect values must be finite numbers');
      // Buff hệ thống là % thuần: phẳng = 0 và pct > 0 (theo spec Phase 2).
      if (isSystemKey && (e.flatPerLevel !== 0 || e.pctPerLevel <= 0)) {
        fail(`system effect "${e.attribute}" requires flatPerLevel = 0 and pctPerLevel > 0`);
      }
    }
  } else if (def.category === 'active') {
    if (def.effects !== null) fail('active công pháp must not set effects');
    if (!(def.powerPerLevel !== null && def.powerPerLevel > 0)) fail('active công pháp requires powerPerLevel > 0');
    if (def.chanNguyenCost !== null && !(def.chanNguyenCost >= 0)) fail('chanNguyenCost must be null or >= 0');
  } else {
    fail(`unknown category "${def.category}"`);
  }

  // Phase 2: tier/branch/gate/Bí Tịch. Tier 2+ = nội dung nhánh → bắt buộc branch + Bí Tịch.
  if (!Number.isInteger(def.tier) || def.tier < 1 || def.tier > 3) fail('tier must be an integer in 1..3');
  if (def.branch !== null && !(BRANCHES as readonly string[]).includes(def.branch)) fail(`unknown branch "${def.branch}"`);
  if (!Number.isInteger(def.minRealmMajor) || def.minRealmMajor < 0) fail('minRealmMajor must be an integer >= 0');
  if (def.tier >= 2) {
    if (def.branch === null) fail('tier >= 2 requires a branch');
    if (def.biTichMaterialId === null) fail('tier >= 2 requires biTichMaterialId');
  }
}
