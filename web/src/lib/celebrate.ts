// Confetti for the good moments (canvas-confetti). Respects "reduce motion".
import confetti from "canvas-confetti";

const GREENS = ["#2d6a4f", "#40916c", "#74c69d", "#b7e4c7", "#f4a261"];
/** Bleu-blanc-rouge for the Habs season. */
const HABS = ["#af1e2d", "#ffffff", "#192168", "#af1e2d", "#2d6a4f"];

type Kind = "join" | "checkin" | "visit" | "trophy" | "season" | "purchase";

/** A burst sized to the moment: small for a join, bigger for trophies and check-ins. */
export function celebrate(kind: Kind = "join"): void {
  if (typeof window === "undefined") return;
  const colors = kind === "season" ? HABS : GREENS;
  const base = { colors, disableForReducedMotion: true, zIndex: 9999 };
  if (kind === "join" || kind === "purchase") {
    void confetti({ ...base, particleCount: 70, spread: 70, origin: { y: 0.75 } });
    return;
  }
  // Two side cannons for the bigger wins.
  const count = kind === "trophy" || kind === "checkin" ? 110 : 80;
  void confetti({ ...base, particleCount: count, angle: 60, spread: 65, origin: { x: 0, y: 0.8 } });
  void confetti({
    ...base,
    particleCount: count,
    angle: 120,
    spread: 65,
    origin: { x: 1, y: 0.8 },
  });
}
