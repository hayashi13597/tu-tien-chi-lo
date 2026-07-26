import type { ExpeditionDurationSec, ExpeditionWins } from "./types";

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
