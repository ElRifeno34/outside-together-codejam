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

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Center of an element as a 0–1 confetti origin (screen middle when there's no element). */
function originOf(el: Element | null): { x: number; y: number } {
  if (!el) return { x: 0.5, y: 0.6 };
  const r = el.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
  };
}

/** Confetti bursting out of a button (used by the activity card's Join). */
export function confettiBurst(el: Element | null): void {
  if (typeof window === "undefined") return;
  void confetti({
    colors: GREENS,
    disableForReducedMotion: true,
    zIndex: 9999,
    particleCount: 60,
    spread: 75,
    startVelocity: 32,
    scalar: 0.9,
    origin: originOf(el),
  });
}

/** A "+15"-style label that floats up from a button and fades (self-contained, no CSS). */
export function coinPop(el: Element | null, text: string): void {
  if (typeof document === "undefined" || !el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const label = document.createElement("span");
  label.textContent = text;
  label.setAttribute("aria-hidden", "true");
  Object.assign(label.style, {
    position: "fixed",
    left: `${r.left + r.width / 2}px`,
    top: `${r.top}px`,
    transform: "translate(-50%, 0)",
    zIndex: "10000",
    pointerEvents: "none",
    font: '700 1.1rem "Lilita One", sans-serif',
    color: "#f4a261",
    textShadow: "0 2px 0 #7a4a1f",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(label);
  label
    .animate(
      [
        { transform: "translate(-50%, 0) scale(0.6)", opacity: 0 },
        { transform: "translate(-50%, -18px) scale(1.15)", opacity: 1, offset: 0.25 },
        { transform: "translate(-50%, -56px) scale(1)", opacity: 0 },
      ],
      { duration: 900, easing: "cubic-bezier(.22,1,.36,1)" },
    )
    .finished.finally(() => label.remove());
}
