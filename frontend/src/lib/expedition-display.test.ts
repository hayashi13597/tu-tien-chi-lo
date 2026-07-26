import { describe, expect, it } from "vitest";
import {
  canQueueAlchemy,
  canStartExpedition,
  expeditionUiMode,
  formatExpeditionDuration,
  formatExpeditionTicketCost,
  rewardPercentForWins,
  secondsRemaining,
} from "./expedition-display";

describe("expedition display helpers", () => {
  it("formats each supported expedition duration and ticket cost", () => {
    expect(formatExpeditionDuration(1800)).toBe("30 phút");
    expect(formatExpeditionDuration(7200)).toBe("2 giờ");
    expect(formatExpeditionDuration(28800)).toBe("8 giờ");
    expect(formatExpeditionTicketCost(28800)).toBe(4);
  });

  it("maps wins to the server reward multiplier percentage", () => {
    expect(rewardPercentForWins(2)).toBe(75);
  });

  it("clamps expired countdowns to zero", () => {
    expect(
      secondsRemaining(
        "2026-07-27T00:00:10Z",
        new Date("2026-07-27T00:00:20Z"),
      ),
    ).toBe(0);
    expect(
      secondsRemaining(
        "2026-07-27T00:00:30Z",
        new Date("2026-07-27T00:00:20Z"),
      ),
    ).toBe(10);
  });

  it("derives available, running and claimable expedition states", () => {
    expect(
      expeditionUiMode({ expedition: null }, new Date("2026-07-27T00:00:00Z")),
    ).toBe("available");
    expect(
      expeditionUiMode(
        {
          expedition: {
            status: "running",
            completesAt: "2026-07-27T01:00:00Z",
          },
        },
        new Date("2026-07-27T00:00:00Z"),
      ),
    ).toBe("running");
    expect(
      expeditionUiMode(
        {
          expedition: {
            status: "completed",
            completesAt: "2026-07-27T01:00:00Z",
          },
        },
        new Date("2026-07-27T00:00:00Z"),
      ),
    ).toBe("claimable");
  });

  it("only enables expedition start when the slot and daily units are available", () => {
    expect(canStartExpedition(null, 1)).toBe(true);
    expect(canStartExpedition({ expedition: null, remainingUnits: 0 }, 1)).toBe(
      false,
    );
    expect(
      canStartExpedition(
        {
          expedition: {
            status: "running",
            completesAt: "2026-07-27T01:00:00Z",
          },
          remainingUnits: 12,
        },
        1,
      ),
    ).toBe(false);
  });

  it("only enables alchemy when all required resources cover the quantity", () => {
    const recipe = {
      id: "recipe",
      pillId: "pill",
      durationSec: 1800,
      linhThachCost: 5,
      active: true,
      ingredients: [{ materialId: "m", quantity: 2 }],
    };
    expect(
      canQueueAlchemy(recipe, [{ materialId: "m", quantity: 4 }], 2, 10),
    ).toBe(true);
    expect(
      canQueueAlchemy(recipe, [{ materialId: "m", quantity: 3 }], 2, 10),
    ).toBe(false);
    expect(
      canQueueAlchemy(recipe, [{ materialId: "m", quantity: 4 }], 2, 9),
    ).toBe(false);
  });
});
