import { describe, expect, it } from "vitest";
import { gradeFor, gradeProgress } from "./progression";

describe("grades", () => {
  it("starts at Bronze I and climbs with points", () => {
    expect(gradeFor(0)).toMatchObject({ name: "Bronze I", metal: "bronze", next: 50 });
    expect(gradeFor(49).name).toBe("Bronze I");
    expect(gradeFor(50).name).toBe("Bronze II");
    expect(gradeFor(200)).toMatchObject({ name: "Silver I", metal: "silver" });
    expect(gradeFor(1199)).toMatchObject({ name: "Gold II", metal: "gold" });
  });

  it("tops out at Platinum", () => {
    expect(gradeFor(1600)).toMatchObject({ name: "Platinum", next: null });
    expect(gradeFor(99999).name).toBe("Platinum");
    expect(gradeProgress(5000)).toBe(1);
  });

  it("measures progress to the next grade", () => {
    expect(gradeProgress(0)).toBe(0);
    expect(gradeProgress(25)).toBe(0.5);
    expect(gradeProgress(250)).toBe(0.5);
  });
});
