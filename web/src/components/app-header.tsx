import { useLanguage } from "@/i18n";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Coins,
  Compass,
  Landmark,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ShoppingBag,
  Shield,
  Sprout,
  Trophy,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { DisplayName, ProfileAvatar } from "@/components/profile-bits";
import * as api from "@/api";
import { useApp } from "./app-provider";
import { ThemeToggle } from "./theme-toggle";

type NavItem = {
  to: "/" | "/map" | "/places" | "/rankings" | "/season" | "/shop" | "/messages" | "/profile";
  label: string;
  Icon: LucideIcon;
};

const NAV: NavItem[] = [
  { to: "/", label: "Explore", Icon: Compass },
  { to: "/map", label: "Map", Icon: MapIcon },
  { to: "/places", label: "Places", Icon: Landmark },
  { to: "/rankings", label: "Rankings", Icon: Trophy },
  { to: "/season", label: "Season pass", Icon: Shield },
  { to: "/shop", label: "Shop", Icon: ShoppingBag },
  { to: "/messages", label: "Messages", Icon: MessageCircle },
  { to: "/profile", label: "My activities", Icon: UserRound },
];

/** Phone tab bar: the four most used, the rest under "More". */
const TABS: NavItem["to"][] = ["/", "/map", "/rankings", "/messages"];

/**
 * App navigation: a vertical sidebar on computers (icons only on tablets), and a slim
 * top bar + bottom tab bar on phones.
 */
export function AppHeader() {
  const { tr } = useLanguage();
  const { profile, openAuth } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadCount();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const badge = (to: string) =>
    to === "/messages" && unread > 0 ? (
      <span className="nav-badge" aria-label={`${unread} ${tr("unread")}`}>
        {unread > 9 ? "9+" : unread}
      </span>
    ) : null;

  return (
    <>
      <aside className="app-sidebar" aria-label={tr("Main navigation")}>
        <Brand />
        <nav className="side-nav">
          {NAV.map(({ to, label, Icon }) => (
            <Link key={to} to={to} data-active={isActive(to)} title={tr(label)}>
              <Icon aria-hidden="true" />
              <span className="side-label">{tr(label)}</span>
              {badge(to)}
            </Link>
          ))}
        </nav>
        <Button asChild className="side-create">
          <Link to="/create" title={tr("Create activity")}>
            <Plus />
            <span className="side-label">{tr("Create activity")}</span>
          </Link>
        </Button>
        <div className="side-bottom">
          {profile ? (
            <SideAccount />
          ) : (
            <Button variant="outline" className="side-signin" onClick={() => openAuth()}>
              <UserRound />
              <span className="side-label">{tr("Sign in")}</span>
            </Button>
          )}
          <Preferences />
        </div>
      </aside>

      <header className="mobile-top">
        <Brand />
        <div className="mobile-top-actions">
          {profile && <CreditsChip />}
          <ThemeToggle />
          {profile ? (
            <Link to="/profile" aria-label={tr("My activities")}>
              <AccountAvatar size={32} />
            </Link>
          ) : (
            <Button size="sm" onClick={() => openAuth()}>
              {tr("Sign in")}
            </Button>
          )}
        </div>
      </header>

      <nav className="tab-bar" aria-label={tr("Main navigation")}>
        {TABS.map((to) => {
          const item = NAV.find((n) => n.to === to)!;
          return (
            <Link key={to} to={to} data-active={isActive(to)}>
              <item.Icon aria-hidden="true" />
              <span>{tr(item.label)}</span>
              {badge(to)}
            </Link>
          );
        })}
        <button
          type="button"
          data-active={more}
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
        >
          {more ? <X aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
          <span>{tr("More")}</span>
        </button>
      </nav>
      {more && (
        <div className="tab-more" role="menu">
          {NAV.filter((n) => !TABS.includes(n.to)).map(({ to, label, Icon }) => (
            <Link key={to} to={to} role="menuitem" data-active={isActive(to)}>
              <Icon aria-hidden="true" /> {tr(label)}
            </Link>
          ))}
          <Link to="/create" role="menuitem" className="tab-more-create">
            <Plus aria-hidden="true" /> {tr("Create activity")}
          </Link>
          <Preferences />
        </div>
      )}
    </>
  );
}

function Brand() {
  const { tr } = useLanguage();
  return (
    <Link to="/" className="brand">
      <motion.span
        className="brand-mark"
        initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        whileHover={{ rotate: [0, -14, 10, -6, 0], transition: { duration: 0.7 } }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
      >
        <Sprout aria-hidden="true" />
      </motion.span>
      <span className="side-label">
        {tr("outside")}
        <span className="brand-together">
          {tr("together")}
          <span className="text-primary">{tr(".")}</span>
        </span>
      </span>
    </Link>
  );
}

/** Theme, language and (when signed in) sign out. */
function Preferences() {
  const { tr, language, setLanguage } = useLanguage();
  const { profile, logout } = useApp();
  return (
    <div className="side-prefs">
      <ThemeToggle />
      <div className="language-switch" role="group" aria-label="Language / Langue">
        {(["en", "fr"] as const).map((lang) => (
          <Button
            key={lang}
            variant="ghost"
            aria-pressed={language === lang}
            onClick={() => setLanguage(lang)}
          >
            {lang.toUpperCase()}
          </Button>
        ))}
      </div>
      {profile && (
        <Button
          variant="ghost"
          size="icon"
          title={tr("Sign out")}
          aria-label={tr("Sign out")}
          onClick={() => void logout()}
        >
          <LogOut />
        </Button>
      )}
    </div>
  );
}

/** My avatar, name and credits at the bottom of the sidebar. */
function SideAccount() {
  const { profile } = useApp();
  const me = useMe();
  if (!profile) return null;
  return (
    <Link to="/profile" className="side-account">
      <AccountAvatar size={38} />
      <span className="side-label side-account-text">
        <DisplayName
          name={profile.display_name}
          effectItem={me.data?.name_effect_item}
          as="strong"
        />
        <CreditsChip plain />
      </span>
    </Link>
  );
}

function AccountAvatar({ size }: { size: number }) {
  const { profile } = useApp();
  const me = useMe();
  if (!profile) return null;
  return (
    <ProfileAvatar
      name={profile.display_name}
      avatarItem={me.data?.avatar_item}
      frameItem={me.data?.frame_item}
      size={size}
    />
  );
}

function useMe() {
  const { profile } = useApp();
  return useQuery({
    queryKey: ["public-profile", profile?.id],
    queryFn: () => api.getPublicProfile(profile!.id),
    enabled: !!profile,
    retry: false,
  });
}

/** Credit balance; links to the shop. Hidden before migration 019. */
function CreditsChip({ plain = false }: { plain?: boolean }) {
  const { tr } = useLanguage();
  const { profile } = useApp();
  const progress = useQuery({
    queryKey: ["my-progress", profile?.id],
    queryFn: api.getMyProgress,
    enabled: !!profile,
    retry: false,
  });
  if (!progress.data) return null;
  return plain ? (
    <small className="side-credits">
      <Coins size={12} /> {progress.data.credits} {tr("credits")}
    </small>
  ) : (
    <Link to="/shop" className="header-credits" title={tr("Your credits · open the shop")}>
      <Coins size={15} /> {progress.data.credits}
    </Link>
  );
}

/** Unread 1:1 messages, kept fresh by Realtime (and a slow refresh). */
function useUnreadCount(): number {
  const { profile } = useApp();
  const client = useQueryClient();
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: api.getConversations,
    enabled: !!profile,
    refetchInterval: 60_000,
    retry: false,
  });
  useEffect(() => {
    if (!profile) return;
    return api.onNewMessage(() => void client.invalidateQueries({ queryKey: ["conversations"] }));
  }, [profile, client]);
  return (conversations.data ?? []).reduce((n, c) => n + c.unread, 0);
}
