import { useLanguage } from "@/i18n";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Compass, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "./account-menu";

/** Outside Together mark: a short line between two stops (one reached, one ahead). */
function LigneMark() {
  return (
    <svg className="wordmark-mark" viewBox="0 0 40 16" aria-hidden="true">
      <line x1="6" y1="8" x2="34" y2="8" />
      <circle cx="6" cy="8" r="5" className="stop-reached" />
      <circle cx="34" cy="8" r="4.25" className="stop-ahead" />
    </svg>
  );
}

/** Desktop: one top bar. Mobile: a slim top bar plus the bottom navigation below. */
export function AppHeader() {
  const { tr } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="wordmark" aria-label="Outside Together">
          <LigneMark />
          <span>Outside Together</span>
        </Link>
        <nav className="topnav" aria-label={tr("Main navigation")}>
          <Link to="/" data-active={pathname === "/"}>
            {tr("Explore")}
          </Link>
          <Link to="/profile" data-active={pathname === "/profile"}>
            {tr("My plans")}
          </Link>
        </nav>
        <div className="topbar-actions">
          <Button asChild className="topbar-start">
            <Link to="/create">
              <Plus />
              {tr("Start one")}
            </Link>
          </Button>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** Mobile-only bottom navigation: Explore | Start one | My plans. */
export function BottomNav() {
  const { tr } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="bottomnav" aria-label={tr("Main navigation")}>
      <Link to="/" data-active={pathname === "/"}>
        <Compass aria-hidden="true" />
        <span>{tr("Explore")}</span>
      </Link>
      <Link to="/create" className="bottomnav-start" data-active={pathname === "/create"}>
        <span className="bottomnav-start-plate" aria-hidden="true">
          <Plus />
        </span>
        <span>{tr("Start one")}</span>
      </Link>
      <Link to="/profile" data-active={pathname === "/profile"}>
        <CalendarCheck aria-hidden="true" />
        <span>{tr("My plans")}</span>
      </Link>
    </nav>
  );
}
