import { useLanguage } from "@/i18n";
import { levelClass } from "./pictogram";

/** Niche level 1–5: colour plus number plus ticks, so it never relies on colour alone. */
export function NicheLevel({ level, className = "" }: { level: number; className?: string }) {
  const { tr } = useLanguage();
  return (
    <span className={`niche-level ${levelClass(level)} ${className}`.trim()}>
      <span className="niche-level-ticks" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} {...(n > level ? { "data-off": "" } : {})} />
        ))}
      </span>
      <span aria-hidden="true">{level}</span>
      <span className="sr-only">
        {tr("Niche level")} {level}/5
      </span>
    </span>
  );
}
