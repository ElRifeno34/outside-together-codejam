import { describe, expect, it } from "vitest";
import { translate } from "@/i18n";

describe("self-confirmation messages", () => {
  it("translates the We're here results into French", () => {
    expect(translate("We're here", "fr")).toBe("On est là");
    expect(translate("We're here! +25 points", "fr")).toBe("On est là ! +25 points");
    expect(translate("You're checked in · waiting for 1 more person", "fr")).toBe(
      "Présence confirmée · encore 1 personne à confirmer",
    );
    expect(translate("You're checked in · waiting for 2 more people", "fr")).toBe(
      "Présence confirmée · encore 2 personnes à confirmer",
    );
  });
});
