import { describe, expect, it } from "vitest";
import {
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
});
