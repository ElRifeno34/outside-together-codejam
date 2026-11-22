import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LANGUAGE_STORAGE_KEY, LanguageProvider, useLanguage } from "@/i18n";

function Probe() {
  const { tr, setLanguage } = useLanguage();
  return (
    <>
      <span data-testid="label">{tr("Explore")}</span>
      <button onClick={() => setLanguage("fr")}>fr</button>
      <button onClick={() => setLanguage("en")}>en</button>
    </>
  );
}

afterEach(() => window.localStorage.clear());

it("restores the stored language after a reload", async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  expect(await screen.findByText("Explorer")).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("fr");
});

it("remembers a language change and ignores unknown stored values", async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "de");
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  expect(screen.getByTestId("label").textContent).toBe("Explore");
  act(() => screen.getByText("fr").click());
  expect(screen.getByTestId("label").textContent).toBe("Explorer");
  expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
});
