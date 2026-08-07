import { CongPhapRecord } from './congphap';
import { ATTRIBUTE_KEYS, AttributeSet } from '../attributes/attributes';
import { DomainError } from '../errors';

const SLUG = /^[a-z0-9-]+$/;

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
      const isKnown = ATTRIBUTE_KEYS.includes(e.attribute as keyof AttributeSet)
        || e.attribute === 'linhKhiRate' || e.attribute === 'danDaoSuccess';
      if (!isKnown) fail(`unknown attribute "${e.attribute}"`);
      if (!Number.isFinite(e.flatPerLevel) || !Number.isFinite(e.pctPerLevel)) fail('effect values must be finite numbers');
    }
  } else if (def.category === 'active') {
    if (def.effects !== null) fail('active công pháp must not set effects');
    if (!(def.powerPerLevel !== null && def.powerPerLevel > 0)) fail('active công pháp requires powerPerLevel > 0');
    if (def.chanNguyenCost !== null && !(def.chanNguyenCost >= 0)) fail('chanNguyenCost must be null or >= 0');
  } else {
    fail(`unknown category "${def.category}"`);
  }
}
