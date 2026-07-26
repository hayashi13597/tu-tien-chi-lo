import { DomainError } from '../errors';
import { MaterialSpendLine } from './material';

export const EXPEDITION_DAILY_TICKET_UNITS = 12;
export const EXPEDITION_DURATIONS = [1_800, 7_200, 28_800] as const;

export function ticketCostForDuration(durationSec: number): 1 | 2 | 4 {
  switch (durationSec) {
    case 1_800:
      return 1;
    case 7_200:
      return 2;
    case 28_800:
      return 4;
    default:
      throw new DomainError('INVALID_EXPEDITION_CONFIG', `unsupported expedition duration: ${durationSec}`);
  }
}

export function availableTicketUnits(quota: Pick<{ spentUnits: number }, 'spentUnits'>): number {
  if (!Number.isInteger(quota.spentUnits) || quota.spentUnits < 0) {
    throw new DomainError('INVALID_EXPEDITION_CONFIG', 'spent ticket units must be a non-negative integer');
  }
  return Math.max(0, EXPEDITION_DAILY_TICKET_UNITS - quota.spentUnits);
}

export function materialCostAtLevel(base: number, growth: number, level: number): number {
  if (!Number.isInteger(base) || base < 0 || !Number.isFinite(growth) || growth < 1 || !Number.isInteger(level) || level < 1) {
    throw new DomainError('INVALID_MATERIAL_CONFIG', 'material upgrade cost configuration is invalid');
  }
  return Math.round(base * Math.pow(growth, level - 1));
}

export function canSpendMaterials(balance: ReadonlyMap<string, number>, lines: readonly MaterialSpendLine[]): boolean {
  const required = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) return false;
    required.set(line.materialId, (required.get(line.materialId) ?? 0) + line.quantity);
  }
  for (const [materialId, quantity] of required) {
    if ((balance.get(materialId) ?? 0) < quantity) return false;
  }
  return true;
}
