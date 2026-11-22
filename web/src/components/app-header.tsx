import { useLanguage } from "@/i18n";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Plus, Sprout, UserRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-provider";
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
          <Link to="/profile" data-active={pathname === "/profile"}>
            {tr("My activities")}
          </Link>
          <Link to="/create" className="mobile-create" data-active={pathname === "/create"}>
            <Plus size={13} />
            <span className="create-label">{tr("Create activity")}</span>
          </Link>
        </nav>
        <div className="header-actions">
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
