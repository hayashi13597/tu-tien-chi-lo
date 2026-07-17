import { describe, it, expect } from 'vitest';
import { applyPillEffect } from '../../src/domain/pills/pill.calc';
import { PillRecord } from '../../src/domain/pills/pill';

const now = new Date('2026-01-01T00:00:00Z');
const charBase = { cultivationBuffMultiplier: null, cultivationBuffUntil: null, breakthroughBonusPct: 0, punishedUntil: null as Date | null };
function pill(over: Partial<PillRecord>): PillRecord {
  return { id: 'p', name: 'p', glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: null, multiplier: null, durationSec: null, bonusPct: null, desc: '', ...over };
}

describe('applyPillEffect', () => {
  it('linhKhi adds amount to current linh khi', () => {
    const r = applyPillEffect({ currentLinhKhi: 100, character: charBase, pill: pill({ effectKind: 'linhKhi', amount: 50 }), now });
    expect(r.linhKhi).toBe(150);
    expect(r.cultivationBuffMultiplier).toBeNull();
  });

  it('cultivationBuff sets multiplier and until = now + durationSec (refresh)', () => {
    const r = applyPillEffect({ currentLinhKhi: 0, character: charBase, pill: pill({ effectKind: 'cultivationBuff', multiplier: 2, durationSec: 180 }), now });
    expect(r.cultivationBuffMultiplier).toBe(2);
    expect(r.cultivationBuffUntil?.getTime()).toBe(now.getTime() + 180_000);
  });

  it('breakthroughBoost replaces breakthroughBonusPct (not additive)', () => {
    const r = applyPillEffect({ currentLinhKhi: 0, character: { ...charBase, breakthroughBonusPct: 5 }, pill: pill({ effectKind: 'breakthroughBoost', bonusPct: 15 }), now });
    expect(r.breakthroughBonusPct).toBe(15);
  });

  it('clearPunishment nulls punishedUntil', () => {
    const r = applyPillEffect({ currentLinhKhi: 0, character: { ...charBase, punishedUntil: new Date(now.getTime() + 60_000) }, pill: pill({ effectKind: 'clearPunishment' }), now });
    expect(r.punishedUntil).toBeNull();
  });

  it('preserves unrelated fields (linhKhi effect keeps existing buff/bonus)', () => {
    const existingUntil = new Date(now.getTime() + 90_000);
    const r = applyPillEffect({ currentLinhKhi: 10, character: { cultivationBuffMultiplier: 2, cultivationBuffUntil: existingUntil, breakthroughBonusPct: 7, punishedUntil: null }, pill: pill({ effectKind: 'linhKhi', amount: 5 }), now });
    expect(r.linhKhi).toBe(15);
    expect(r.cultivationBuffMultiplier).toBe(2);
    expect(r.breakthroughBonusPct).toBe(7);
  });
});
