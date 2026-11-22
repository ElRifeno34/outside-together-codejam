import { Link } from "@tanstack/react-router";
import { Check, Languages, LogOut, UserRound } from "lucide-react";
import { useLanguage, type Language } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "./app-provider";

const languages: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

function LanguageItems() {
  const { tr, language, setLanguage } = useLanguage();
  return (
    <>
      <DropdownMenuLabel className="account-menu-label">
        <Languages aria-hidden="true" />
        {tr("Language")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={language}
        onValueChange={(value) => setLanguage(value === "fr" ? "fr" : "en")}
      >
        {languages.map((l) => (
          <DropdownMenuRadioItem key={l.id} value={l.id} lang={l.id}>
            {l.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

/**
 * Signed in: the avatar opens identity, points, My plans, language and sign out.
 * Signed out: a direct "Sign in" button plus a compact language menu.
 */
export function AccountMenu() {
  const { tr, language } = useLanguage();
  const { profile, openAuth, logout } = useApp();

  if (!profile)
    return (
      <div className="account-signed-out">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="lang-trigger" aria-label={tr("Language")}>
              <Languages />
              <span aria-hidden="true">{language.toUpperCase()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="account-menu">
            <LanguageItems />
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={() => openAuth()}>
          <UserRound />
          {tr("Sign in")}
        </Button>
      </div>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="account-avatar"
          aria-label={`${tr("Account")}: ${profile.display_name}`}
        >
          {profile.display_name.charAt(0).toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="account-menu">
        <div className="account-menu-identity">
          <strong>{profile.display_name}</strong>
          <span>
            <Check aria-hidden="true" />
            {profile.total_points} {tr("total points")}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">{tr("My plans")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LanguageItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden="true" />
          {tr("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
