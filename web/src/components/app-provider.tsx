import { useLanguage } from "@/i18n";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import * as api from "@/api";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { celebrate } from "@/lib/celebrate";

type AppContextValue = {
  profile: Profile | null;
  /**
   * Opens the Google sign-in dialog. Sign-in leaves the page, so the optional follow-up
   * action can't run afterwards; the person returns to the same page and taps it again.
   */
  openAuth: (after?: () => Promise<void>) => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("App context unavailable");
  return c;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const { tr, language } = useLanguage();
  const client = useQueryClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () =>
      api
        .getMyProfile()
        .then((p) => {
          setProfile(p);
          return p;
        })
        .catch(() => {
          setProfile(null);
          return null;
        });
    void load();
    // Back from Google with a refusal (e.g. an email that already had an account):
    // explain it and return to the page they started from.
    const refused = api.takeSignInError();
    if (refused) {
      toast.error(tr(refused), { duration: 8000 });
      const back = api.takeReturnPath();
      if (back && back !== window.location.pathname + window.location.search)
        router.history.push(back);
    }
    // Pick up the session restored after the Google redirect, token refreshes and
    // sign-outs in other tabs.
    return api.onAuthChange((event) => {
      void load().then((p) => {
        if (event !== "SIGNED_IN" || !p) return;
        // Back from Google: return to the page they started from and greet them.
        const back = api.takeReturnPath();
        if (back === null) return;
        if (back !== window.location.pathname + window.location.search) router.history.push(back);
        toast.success(tr(`You're in, ${p.display_name}!`));
      });
      void client.invalidateQueries();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; tr only formats the toast
  }, [client, router]);
  // New trophies (migration 019): checked after anything that can earn points, toasted once.
  const checkTrophies = async () => {
    try {
      const fresh = await api.refreshTrophies();
      if (!fresh.length) return;
      const defs = await api.getTrophies();
      for (const id of fresh) {
        const t = defs.find((d) => d.id === id);
        if (!t) continue;
        celebrate("trophy");
        toast.success(
          `🏆 ${tr("Trophy unlocked:")} ${tr(t.name)} (+${t.credits} ${tr("credits")})`,
        );
      }
      await client.invalidateQueries({ queryKey: ["public-profile"] });
      await client.invalidateQueries({ queryKey: ["my-progress"] });
    } catch {
      // Before migration 019 there are no trophies: nothing to celebrate.
    }
  };
  const refreshProfile = async () => {
    setProfile(await api.getMyProfile());
    await client.invalidateQueries();
    void checkTrophies();
  };
  useEffect(() => {
    if (profile?.id) void checkTrophies();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per signed-in person
  }, [profile?.id]);
  return (
    <AppContext.Provider
      value={{
        profile,
        openAuth: () => {
          setError("");
          setBusy(false);
          setOpen(true);
        },
        refreshProfile,
        logout: async () => {
          await api.signOut();
          setProfile(null);
          await client.invalidateQueries();
        },
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="auth-mark">{tr("↗")}</div>
          <DialogTitle className="font-display text-2xl">
            {tr("Good company starts here.")}
          </DialogTitle>
          <DialogDescription>
            {tr("Sign in or create your account with Google to join your next one-hour adventure.")}
          </DialogDescription>
          <Button
            className="w-full"
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                // Leaves the page; onAuthChange restores the profile when Google sends us back.
                await api.signInWithGoogle(window.location.href);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Google sign-in is unavailable. Try again.",
                );
                setBusy(false);
              }
            }}
          >
            <GoogleMark />
            {busy ? tr("Opening Google…") : tr("Continue with Google")}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {tr(error)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {tr(
              "We only use your Google name and email. New here? Your account is created on your first sign-in.",
            )}
          </p>
        </DialogContent>
      </Dialog>
    </AppContext.Provider>
  );
}

/** Google's "G", drawn inline so the button needs no external image. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
