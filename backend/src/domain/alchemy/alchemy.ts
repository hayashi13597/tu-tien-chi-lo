import { MaterialSpendLine } from '../materials/material';

export type AlchemyJobStatus = 'queued' | 'running' | 'completed';

export interface AlchemyIngredientLine extends MaterialSpendLine {}

export interface AlchemyRecipeRecord {
  id: string;
  pillId: string;
  durationSec: number;
  linhThachCost: number;
  active: boolean;
  ingredients: AlchemyIngredientLine[];
}

export interface AlchemyJobRecord {
  id: string;
  userId: string;
  characterId: string;
  recipeId: string;
  quantity: number;
  queuedAt: Date;
  startsAt: Date;
  completesAt: Date;
  completedAt: Date | null;
  outputGrantedAt: Date | null;
  status: AlchemyJobStatus;
}

export interface AlchemyOutputGrant {
  pillId: string;
  quantity: number;
}

export interface AlchemyQueueOutput {
  jobs: AlchemyJobRecord[];
  outputGrants: AlchemyOutputGrant[];
}

export interface AlchemySettlement extends AlchemyQueueOutput {
  completedJobIds: string[];
  nextRunning: AlchemyJobRecord | null;
}
