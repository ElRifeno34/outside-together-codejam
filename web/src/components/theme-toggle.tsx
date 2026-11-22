import { useLanguage } from "@/i18n";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyTheme,
  effectiveTheme,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme";

/** Sun / moon button: switches between light and dark and remembers the choice. */
export function ThemeToggle() {
  const { tr } = useLanguage();
  const [pref, setPref] = useState<ThemePreference>("system");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const initial = readThemePreference();
    setPref(initial);
    setDark(effectiveTheme(initial) === "dark");
    // While following the system, react when the system theme changes.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemePreference() !== "system") return;
      applyTheme("system");
      setDark(media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: ThemePreference = dark ? "light" : "dark";
    saveThemePreference(next);
    setPref(next);
    setDark(next === "dark");
  };

  const label = tr(dark ? "Switch to light mode" : "Switch to dark mode");
  return (
    <Button
      variant="ghost"
      size="icon"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={pref === "system" ? `${label} (${tr("following your system")})` : label}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
