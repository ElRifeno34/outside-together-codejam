// Celebrations.
// - confettiBurst / coinPop: the Lively UI's dependency-free burst and "+N" coin from a
//   button (styled by .confetti-layer / .coin-pop in lively.css).
// - celebrate(kind): full-screen canvas-confetti for bigger moments (check-in, place visit,
//   trophy, season reward, purchase); bleu-blanc-rouge for the Habs season.
// Everything is skipped when the person asks for reduced motion.
import confetti from "canvas-confetti";

const COLORS = ["#ff4fa3", "#3d7bff", "#ffd23f", "#8b5cf6", "#22c55e", "#ff7a1a"];

function reducedMotion() {
  return (
    typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Confetti bursting out of `origin` (an element, usually the button that was clicked). */
export function confettiBurst(origin: Element | null, count = 42) {
  if (reducedMotion() || !origin) return;
  const box = origin.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("span");
    bit.className = "confetti-bit";
    const angle = Math.random() * Math.PI * 2;
    const power = 90 + Math.random() * 170;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = COLORS[i % COLORS.length]!;
    bit.style.setProperty("--dx", `${Math.cos(angle) * power}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * power - 120}px`);
    bit.style.setProperty("--spin", `${Math.random() * 900 - 450}deg`);
    bit.style.animationDelay = `${Math.random() * 60}ms`;
    if (i % 3 === 0) bit.style.borderRadius = "50%";
    layer.appendChild(bit);
  }
  window.setTimeout(() => layer.remove(), 1400);
}

/** A "+25" coin label that floats up from `origin`. */
export function coinPop(origin: Element | null, text: string) {
  if (reducedMotion() || !origin) return;
  const box = origin.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "coin-pop";
  pop.textContent = text;
  pop.style.left = `${box.left + box.width / 2}px`;
  pop.style.top = `${box.top}px`;
  document.body.appendChild(pop);
  window.setTimeout(() => pop.remove(), 1300);
}

/** Bleu-blanc-rouge for the Habs season. */
const HABS = ["#af1e2d", "#ffffff", "#192168", "#af1e2d", "#2d6a4f"];

type Kind = "join" | "checkin" | "visit" | "trophy" | "season" | "purchase";

/** Full-screen confetti sized to the moment: small for a join, bigger for trophies and check-ins. */
export function celebrate(kind: Kind = "join"): void {
  if (typeof window === "undefined") return;
  const colors = kind === "season" ? HABS : COLORS;
  const base = { colors, disableForReducedMotion: true, zIndex: 9999 };
  if (kind === "join" || kind === "purchase") {
    void confetti({ ...base, particleCount: 70, spread: 70, origin: { y: 0.75 } });
    return;
  }
  // Two side cannons for the bigger wins.
  const count = kind === "trophy" || kind === "checkin" ? 110 : 80;
  void confetti({ ...base, particleCount: count, angle: 60, spread: 65, origin: { x: 0, y: 0.8 } });
  void confetti({ ...base, particleCount: count, angle: 120, spread: 65, origin: { x: 1, y: 0.8 } });
}
