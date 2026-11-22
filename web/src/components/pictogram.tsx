import {
  AudioLines,
  Bird,
  BookOpen,
  Camera,
  ChessKnight,
  Coffee,
  Dribbble,
  Footprints,
  Leaf,
  MapPinned,
  Origami,
  PenTool,
  PersonStanding,
  Sandwich,
  Signpost,
  Sunset,
  type LucideIcon,
} from "lucide-react";

/** One distinct glyph per activity visual key (see lib/activity-visuals.ts). */
export const activityIcons: Record<string, LucideIcon> = {
  walk: Footprints,
  basketball: Dribbble,
  study: BookOpen,
  chess: ChessKnight,
  photo: Camera,
  sketch: PenTool,
  picnic: Sandwich,
  coffee: Coffee,
  jog: PersonStanding,
  sunset: Sunset,
  neighbourhood: Signpost,
  bird: Bird,
  geocache: MapPinned,
  origami: Origami,
  moss: Leaf,
  sound: AudioLines,
};

export function levelClass(level: number): string {
  return `level-${Math.min(5, Math.max(1, Math.round(level)))}`;
}

/** A Ligne sign plate: the activity's glyph in white on its niche-level colour. */
export function Pictogram({
  kind,
  level,
  size = 32,
  className = "",
}: {
  kind: string;
  level: number;
  size?: number;
  className?: string;
}) {
  const Icon = activityIcons[kind] ?? Footprints;
  return (
    <span
      className={`pictogram ${levelClass(level)} ${className}`.trim()}
      style={{ "--plate": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}
