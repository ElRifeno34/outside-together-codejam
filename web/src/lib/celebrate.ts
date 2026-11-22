// Lively UI test: a tiny, dependency-free confetti burst and "+N" coin pop.
// Skipped entirely when the person asks for reduced motion.

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
