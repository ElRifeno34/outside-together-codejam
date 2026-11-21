import { Compass, Sparkles } from "lucide-react";
import { rewardCatalog } from "@/data/rewards";
import { useLanguage } from "@/i18n";
import "./profile-identity.css";
export function ProfileAvatar({
  name,
  frame,
  small = false,
}: {
  name: string;
  frame?: string | undefined;
  small?: boolean;
}) {
  const theme = rewardCatalog.find((r) => r.id === frame && r.kind === "frame")?.theme;
  return (
    <span
      className="profile-identity-avatar"
      data-size={small ? "small" : "normal"}
      data-frame={theme}
    >
      {name.charAt(0)}
    </span>
  );
}
export function ProfileBadge({ badge }: { badge?: string | undefined }) {
  const { tr } = useLanguage();
  const item = rewardCatalog.find((r) => r.id === badge && r.kind === "badge");
  if (!item) return null;
  const Icon = item.theme === "explorer" ? Compass : Sparkles;
  return (
    <span className="profile-earned-badge">
      <Icon size={13} />
      {tr(item.name)}
    </span>
  );
}
