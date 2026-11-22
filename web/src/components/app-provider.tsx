import { useLanguage } from "@/i18n";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/api";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type AppContextValue = {
  profile: Profile | null;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [after, setAfter] = useState<(() => Promise<void>) | undefined>();
  useEffect(() => {
    const load = () =>
      void api
        .getMyProfile()
        .then(setProfile)
        .catch(() => setProfile(null));
    load();
    // Pick up the session restored after the Google redirect, token refreshes and
    // sign-outs in other tabs.
    return api.onAuthChange(() => {
      load();
      void client.invalidateQueries();
    });
  }, [client]);
  const refreshProfile = async () => {
    setProfile(await api.getMyProfile());
    await client.invalidateQueries();
  };
  const finish = async (p: Profile) => {
    setProfile(p);
    setOpen(false);
    setError("");
    await client.invalidateQueries();
    if (after) {
      const action = after;
      setAfter(undefined);
      await action();
    }
    toast.success(tr(`You're in, ${p.display_name}!`));
  };
  return (
    <AppContext.Provider
      value={{
        profile,
        openAuth: (action) => {
          setAfter(() => action);
          setError("");
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
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setAfter(undefined);
        }}
      >
        <DialogContent>
          <div className="auth-mark">{tr("↗")}</div>
          <DialogTitle className="font-display text-2xl">
            {signup ? tr("Make a little room for outside.") : tr("Good company starts here.")}
          </DialogTitle>
          <DialogDescription>
            {signup
              ? tr("Create your Outside Together account.")
              : tr("Sign in to join your next one-hour adventure.")}
          </DialogDescription>
          <div className="flex gap-2">
            <Button
              variant={signup ? "ghost" : "secondary"}
              onClick={() => {
                setSignup(false);
                setError("");
              }}
            >
              {tr("Sign in")}
            </Button>
            <Button
              variant={signup ? "secondary" : "ghost"}
              onClick={() => {
                setSignup(true);
                setError("");
              }}
            >
              {tr("Sign up")}
            </Button>
          </div>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await finish(
                  signup
                    ? await api.signUp(email, name, password)
                    : await api.signIn(email, password),
                );
                setPassword("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Please try again");
              } finally {
                setBusy(false);
              }
            }}
          >
            {signup && (
              <label className="field">
                {tr("Display name")}
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr("Your name")}
                />
              </label>
            )}
            <label className="field">
              {tr("Email")}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tr("you@example.com")}
              />
            </label>
            <label className="field">
              {tr("Password")}
              <input
                type="password"
                required
                minLength={6}
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {tr(error ?? "")}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? tr("One moment…") : signup ? tr("Create account") : tr("Sign in")}{" "}
              <span>{tr("↗")}</span>
            </Button>
          </form>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                // Leaves the page; onAuthChange restores the profile when Google sends us back.
                await api.signInWithGoogle(window.location.href);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Please try again");
                setBusy(false);
              }
            }}
          >
            {tr("Continue with Google")}
          </Button>
        </DialogContent>
      </Dialog>
    </AppContext.Provider>
  );
}
