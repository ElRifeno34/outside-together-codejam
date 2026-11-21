import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { french } from "./fr";
export type Language = "en" | "fr";
export function translate(text: string, language: Language): string {
  if (language === "en") return text;
  const key = text.trim();
  const translated = french[key];
  if (translated) return text.replace(key, translated);
  const found = key.match(/^Found one at (.*), (\d+) people are in\.$/);
  if (found) {
    const clock = (found[1] ?? "").match(/(\d+):(\d+)\s*(am|pm)/i);
    const time = clock
      ? `${(Number(clock[1]) % 12) + (clock[3]?.toLowerCase() === "pm" ? 12 : 0)} h ${clock[2]}`
      : found[1];
    return `Une activité à ${time}, ${found[2]} personnes sont inscrites.`;
  }
  const points = key.match(/^\+(\d+) points$/);
  if (points) return `+${points[1]} points`;
  const welcome = key.match(/^You're in, (.*)!$/);
  if (welcome) return `Bienvenue, ${welcome[1]} !`;
  const join = key.match(/^You're joining (.*)!$/);
  if (join) return `Vous participez à ${translate(join[1] ?? "", language)} !`;
  return text;
}
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  tr: (text: string) => string;
}>({ language: "en", setLanguage: () => {}, tr: (s) => s });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, tr: (text) => translate(text, language) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
