import type {
  AlchemyRecipeDTO,
  CurrentExpeditionDTO,
  ExpeditionDTO,
  ExpeditionDurationSec,
  ExpeditionWins,
  MaterialInventoryDTO,
} from "./types";

export function formatExpeditionDuration(
  durationSec: ExpeditionDurationSec,
): string {
  switch (durationSec) {
    case 1800:
      return "30 phút";
    case 7200:
      return "2 giờ";
    case 28800:
      return "8 giờ";
  }
}

export function formatExpeditionTicketCost(
  durationSec: ExpeditionDurationSec,
): 1 | 2 | 4 {
  switch (durationSec) {
    case 1800:
      return 1;
    case 7200:
      return 2;
    case 28800:
      return 4;
  }
}

export function rewardPercentForWins(wins: ExpeditionWins): number {
  return [25, 50, 75, 100][wins];
}

export function secondsRemaining(
  completesAt: string,
  now = new Date(),
): number {
  return Math.max(
    0,
    Math.ceil((Date.parse(completesAt) - now.getTime()) / 1000),
  );
}

export type ExpeditionUiMode = "available" | "running" | "claimable";

type ExpeditionUiSnapshot = {
  expedition: Pick<ExpeditionDTO, "status" | "completesAt"> | null;
};

export function expeditionUiMode(
  current: ExpeditionUiSnapshot,
  now = new Date(),
): ExpeditionUiMode {
  const expedition = current.expedition;
  if (!expedition || expedition.status === "claimed") return "available";
  if (
    expedition.status === "completed" ||
    secondsRemaining(expedition.completesAt, now) === 0
  ) {
    return "claimable";
  }
  return "running";
}

export function canStartExpedition(
  current:
    | (ExpeditionUiSnapshot & Pick<CurrentExpeditionDTO, "remainingUnits">)
    | null,
  ticketCost: number,
): boolean {
  if (!current) return true;
  return current.expedition === null && current.remainingUnits >= ticketCost;
}

export function canQueueAlchemy(
  recipe: Pick<AlchemyRecipeDTO, "active" | "linhThachCost" | "ingredients">,
  inventory: readonly Pick<MaterialInventoryDTO, "materialId" | "quantity">[],
  quantity: number,
  linhThach: number,
): boolean {
  if (!recipe.active || !Number.isInteger(quantity) || quantity <= 0) {
    return false;
  }
  if (linhThach < recipe.linhThachCost * quantity) return false;
  const balances = new Map(
    inventory.map((entry) => [entry.materialId, entry.quantity]),
  );
  return recipe.ingredients.every(
    (ingredient) =>
      (balances.get(ingredient.materialId) ?? 0) >=
      ingredient.quantity * quantity,
  );
}
