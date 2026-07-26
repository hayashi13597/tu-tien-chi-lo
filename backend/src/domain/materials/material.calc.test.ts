import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  availableTicketUnits,
  canSpendMaterials,
  materialCostAtLevel,
  ticketCostForDuration,
} from './material.calc';

describe('material calculation', () => {
  it('tính chi phí vé theo thời lượng và số vé còn lại trong ngày', () => {
    expect(ticketCostForDuration(1_800)).toBe(1);
    expect(ticketCostForDuration(7_200)).toBe(2);
    expect(ticketCostForDuration(28_800)).toBe(4);
    expect(availableTicketUnits({ spentUnits: 5 })).toBe(7);
    expect(availableTicketUnits({ spentUnits: 20 })).toBe(0);
  });

  it('tính material cost lũy tiến và làm tròn', () => {
    expect(materialCostAtLevel(2, 1.5, 1)).toBe(2);
    expect(materialCostAtLevel(2, 1.5, 2)).toBe(3);
    expect(materialCostAtLevel(2, 1.5, 3)).toBe(5);
  });

  it('từ chối duration ngoài whitelist và cost không hợp lệ', () => {
    expect(() => ticketCostForDuration(60)).toThrow(DomainError);
    expect(() => materialCostAtLevel(-1, 1.5, 1)).toThrow(DomainError);
    expect(() => materialCostAtLevel(2, 0.9, 1)).toThrow(DomainError);
    expect(() => materialCostAtLevel(2, 1.5, 0)).toThrow(DomainError);
  });

  it('kiểm tra đủ tất cả material trước khi spend', () => {
    const balance = new Map([
      ['xich-viem-tinh', 3],
      ['han-bang-ngoc', 1],
    ]);
    expect(canSpendMaterials(balance, [
      { materialId: 'xich-viem-tinh', quantity: 2 },
      { materialId: 'han-bang-ngoc', quantity: 1 },
    ])).toBe(true);
    expect(canSpendMaterials(balance, [
      { materialId: 'xich-viem-tinh', quantity: 4 },
      { materialId: 'han-bang-ngoc', quantity: 1 },
    ])).toBe(false);
  });
});
