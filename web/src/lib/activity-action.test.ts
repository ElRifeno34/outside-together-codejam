import { describe, expect, it } from "vitest";
import { actionState, type ActionInput } from "./activity-action";

const base: ActionInput = {
  joined: false,
  checkedIn: false,
  started: false,
  ended: false,
  availableSpots: 3,
  status: "open",
};
const at = (over: Partial<ActionInput>) => actionState({ ...base, ...over });

describe("activity page primary action", () => {
  it("offers Join before the start when there is room", () => {
    expect(at({})).toBe("join");
    expect(at({ status: "confirmed" })).toBe("join");
  });

  it("shows Full or Cancelled instead of Join", () => {
    expect(at({ availableSpots: 0 })).toBe("full");
    expect(at({ status: "cancelled" })).toBe("cancelled");
  });

  it("registered people see You're in (with Leave) until the start", () => {
    expect(at({ joined: true })).toBe("registered");
  });

  it("closes registration for others once it has started", () => {
    expect(at({ started: true })).toBe("closed");
    expect(at({ started: true, ended: true })).toBe("departed");
  });

  it("offers We're here to registered people from the start, even after the hour", () => {
    expect(at({ joined: true, started: true })).toBe("check-in");
    expect(at({ joined: true, started: true, ended: true })).toBe("check-in");
  });

  it("waits for a second check-in, then shows the points", () => {
    expect(at({ joined: true, checkedIn: true, started: true, status: "open" })).toBe("waiting");
    expect(at({ joined: true, checkedIn: true, started: true, status: "done" })).toBe("earned");
  });
});
