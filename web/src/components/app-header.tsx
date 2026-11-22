import { useLanguage } from "@/i18n";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Coins, LogOut, MapPin, Plus, Sprout, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api";
import { useApp } from "./app-provider";
import { ThemeToggle } from "./theme-toggle";
export function AppHeader() {
  const { tr, language, setLanguage } = useLanguage();
  const { profile, openAuth, logout } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <Sprout aria-hidden="true" />
          <span>
            {tr("outside")}
            <span className="brand-together">
              {tr("together")}
              <span className="text-primary">{tr(".")}</span>
            </span>
          </span>
        </Link>
        <nav className="main-nav" aria-label={tr("Main navigation")}>
          <Link to="/" data-active={pathname === "/"}>
            {tr("Explore")}
          </Link>
          <Link to="/map" data-active={pathname === "/map"}>
            {tr("Map")}
          </Link>
          <Link to="/places" data-active={pathname === "/places"}>
            {tr("Places")}
          </Link>
          <Link to="/rankings" data-active={pathname === "/rankings"}>
            {tr("Rankings")}
          </Link>
          <Link to="/shop" data-active={pathname === "/shop"}>
            {tr("Shop")}
          </Link>
          <Link to="/profile" data-active={pathname === "/profile"}>
            {tr("My activities")}
          </Link>
          <Link to="/create" className="mobile-create" data-active={pathname === "/create"}>
            <Plus size={13} />
            <span className="create-label">{tr("Create activity")}</span>
          </Link>
        </nav>
        <div className="header-actions">
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
          <span className="location">
            <MapPin size={15} /> {tr("Montréal, QC")}
          </span>
          <Button variant="outline" asChild className="create-header">
            <Link to="/create">
              <Plus />
              <span className="create-label">{tr("Create activity")}</span>
            </Link>
          </Button>
          {profile ? (
            <>
              <HeaderCredits />
              <Link to="/profile" className="account-switch">
                {profile.display_name}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title={tr("Sign out")}
                aria-label={tr("Sign out")}
                onClick={() => void logout()}
              >
                <LogOut />
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={() => openAuth()}>
              <UserRound />
              <span>{tr("Sign in")}</span>
              <ArrowUpRight className="signin-arrow" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Credit balance next to the name; links to the shop. Hidden before migration 019. */
function HeaderCredits() {
  const { tr } = useLanguage();
  const { profile } = useApp();
  const progress = useQuery({
    queryKey: ["my-progress", profile?.id],
    queryFn: api.getMyProgress,
    enabled: !!profile,
    retry: false,
  });
  if (!progress.data) return null;
  return (
    <Link to="/shop" className="header-credits" title={tr("Your credits · open the shop")}>
      <Coins size={15} /> {progress.data.credits}
    </Link>
  );
}
