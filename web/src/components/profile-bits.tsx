import { useLanguage } from "@/i18n";
import { Award, Crown, Medal, Trophy } from "lucide-react";
import { AVATARS, gradeFor, type TrophyTier } from "@/lib/progression";

/** Profile picture (illustrated avatar or initial) inside its equipped frame. */
export function ProfileAvatar({
  name,
  avatarItem,
  frameItem,
  size = 40,
}: {
  name: string;
  avatarItem?: string | null | undefined;
  frameItem?: string | null | undefined;
  size?: number;
}) {
  const avatar = avatarItem ? AVATARS[avatarItem] : undefined;
  return (
    <span
      className="pf-avatar"
      data-frame={frameItem ?? undefined}
      style={{ width: size, height: size, fontSize: size * (avatar ? 0.55 : 0.42) }}
      aria-hidden="true"
    >
      <span
        className="pf-avatar-face"
        style={avatar ? { background: avatar.background } : undefined}
      >
        {avatar ? avatar.emoji : name.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

/** A display name with its equipped name effect (gradient, glow…). */
export function DisplayName({
  name,
  effectItem,
  as: Tag = "span",
}: {
  name: string;
  effectItem?: string | null | undefined;
  as?: "span" | "strong" | "h1";
}) {
  return (
    <Tag className="pf-name" data-effect={effectItem ?? undefined}>
      {name}
    </Tag>
  );
}

/** Bronze / Silver / Gold / Platinum insignia for a points total. */
export function GradeBadge({ points, compact = false }: { points: number; compact?: boolean }) {
  const { tr } = useLanguage();
  const g = gradeFor(points);
  const Icon = g.metal === "platinum" ? Crown : Medal;
  return (
    <span className="grade-badge" data-metal={g.metal} title={tr(g.name)}>
      <Icon aria-hidden="true" />
      {!compact && <span>{tr(g.name)}</span>}
      {compact && <span className="sr-only">{tr(g.name)}</span>}
    </span>
  );
}

/** A trophy "sticker", coloured by tier; greyed out until earned. */
export function TrophyBadge({
  tier,
  name,
  description,
  earned = true,
  size = "md",
}: {
  tier: TrophyTier;
  name: string;
  description?: string;
  earned?: boolean;
  size?: "sm" | "md";
}) {
  const { tr } = useLanguage();
  const Icon = tier === "platinum" ? Crown : tier === "gold" ? Trophy : Award;
  return (
    <span
      className="trophy-badge"
      data-tier={tier}
      data-earned={earned}
      data-size={size}
      title={description ? `${tr(name)} · ${tr(description)}` : tr(name)}
    >
      <span className="trophy-icon">
        <Icon aria-hidden="true" />
      </span>
      {size === "md" && (
        <span className="trophy-text">
          <strong>{tr(name)}</strong>
          {description && <small>{tr(description)}</small>}
        </span>
      )}
    </span>
  );
}
