import { PillRecord, PillEffectKind } from './pill';
import { DomainError } from '../errors';

type StatField = 'amount' | 'multiplier' | 'durationSec' | 'bonusPct';

// Which stat fields each effect kind uses. Fields OUTSIDE a kind's list must be
// null — orphaned values would silently mislead a later admin reading the row
// (e.g. a linhKhi pill carrying a stale bonusPct that looks meaningful).
const KIND_FIELDS: Record<PillEffectKind, StatField[]> = {
  linhKhi: ['amount'],
  cultivationBuff: ['multiplier', 'durationSec'],
  breakthroughBoost: ['bonusPct'],
  clearPunishment: [],
};

function fail(message: string): never {
  throw new DomainError('INVALID_PILL_CONFIG', message);
}

// Business invariants zod's per-field ranges can't express (they depend on
// effectKind). The presentation layer's zod schema handles shape/types; this is
// the single domain authority on what a coherent pill definition is.
export function validatePillDefinition(pill: PillRecord): void {
  if (pill.name.trim() === '') fail('name must not be empty');
  if (pill.glyph.trim() === '') fail('glyph must not be empty');
  if (pill.desc.trim() === '') fail('desc must not be empty');
  if (!Number.isInteger(pill.rarity) || pill.rarity < 0 || pill.rarity > 4) {
    fail('rarity must be an integer between 0 and 4');
  }
  if (!Number.isInteger(pill.starterQuantity) || pill.starterQuantity < 0) {
    fail('starterQuantity must be an integer >= 0');
  }

  const used = KIND_FIELDS[pill.effectKind];

  // Per-kind stat requirements.
  if (pill.effectKind === 'linhKhi' && !(pill.amount !== null && pill.amount > 0)) {
    fail('linhKhi pills require amount > 0');
  }
  if (pill.effectKind === 'cultivationBuff') {
    if (!(pill.multiplier !== null && pill.multiplier > 1)) fail('cultivationBuff pills require multiplier > 1');
    if (!(pill.durationSec !== null && Number.isInteger(pill.durationSec) && pill.durationSec > 0)) {
      fail('cultivationBuff pills require an integer durationSec > 0');
    }
  }
  if (pill.effectKind === 'breakthroughBoost' && !(pill.bonusPct !== null && pill.bonusPct > 0)) {
    fail('breakthroughBoost pills require bonusPct > 0');
  }

  // Orphan check: every stat field not used by this kind must be null.
  const allFields: StatField[] = ['amount', 'multiplier', 'durationSec', 'bonusPct'];
  for (const field of allFields) {
    if (!used.includes(field) && pill[field] !== null) {
      fail(`${field} must be null for effectKind "${pill.effectKind}"`);
    }
  }
}
