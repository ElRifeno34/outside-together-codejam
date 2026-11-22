import { describe, expect, it } from "vitest";
import { activityPhase, participationLabel } from "./participation";

const a = { starts_at: "2099-01-01T15:00:00.000Z", duration_min: 60 };
const at = (iso: string) => new Date(iso).getTime();
const before = at("2099-01-01T14:00:00.000Z");
const during = at("2099-01-01T15:20:00.000Z");
const after = at("2099-01-01T16:01:00.000Z");

describe("activity phase", () => {
  it("is upcoming, live, then finished after its hour", () => {
    expect(activityPhase(a, before)).toBe("upcoming");
    expect(activityPhase(a, during)).toBe("live");
    expect(activityPhase(a, at("2099-01-01T16:00:00.000Z"))).toBe("finished");
  });
});

describe("my participation label", () => {
  it("says Joined before the start", () => {
    expect(participationLabel("joined", a, before)).toEqual({ label: "Joined", tone: "neutral" });
  });

  it("says Late while the activity runs and I haven't checked in", () => {
    expect(participationLabel("joined", a, during)).toEqual({
      label: "Late · check in now",
      tone: "warning",
    });
  });

  it("says Finished once the hour is over", () => {
    expect(participationLabel("joined", a, after).label).toBe("Finished · not checked in");
    expect(participationLabel("confirmed", a, after).label).toBe("Finished · checked in");
  });

  it("keeps Checked in during the activity and Left whenever", () => {
    expect(participationLabel("confirmed", a, during).label).toBe("Checked in");
    expect(participationLabel("left", a, after).label).toBe("Left activity");
  });
});
