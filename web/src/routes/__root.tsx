import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  useRouterState,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "@/components/app-provider";
import { AppHeader } from "@/components/app-header";
import { PageFade } from "@/components/motion";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { LanguageProvider, useLanguage } from "@/i18n";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { backendMode, isNotConfiguredError, SupabaseNotConfiguredError } from "@/lib/supabase";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Developer-facing setup screen: shown instead of the app when Supabase isn't configured. */
function NotConfiguredScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Supabase is not configured
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Outside Together needs its Supabase backend. Create <code>web/.env.local</code> with{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see{" "}
          <code>web/.env.example</code>), then restart the dev server.
        </p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const notConfigured = isNotConfiguredError(error);
  if (!notConfigured) console.error(error);
  const router = useRouter();
  useEffect(() => {
    if (!notConfigured) reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, notConfigured]);
  if (notConfigured) return <NotConfiguredScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Outside Together · Montréal" },
      {
        name: "description",
        content: "Find people for spontaneous one-hour activities in Montréal.",
      },
      { property: "og:title", content: "Outside Together · Montréal" },
      {
        property: "og:description",
        content: "One hour outside. A few new faces. Find your next Montréal activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&family=Lilita+One&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  // Without the Supabase environment variables there is no backend: stop before any loader runs.
  beforeLoad: () => {
    if (backendMode !== "supabase") throw new SupabaseNotConfiguredError();
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets .dark before the first paint (no white flash); see src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <LanguageProvider>
        <AppProvider>
          <MotionConfig reducedMotion="user">
            <div className="app-shell">
              <AppHeader />
              <div className="app-main">
                <RouteFade>
                  <Outlet />
                </RouteFade>
                <AppFooter />
              </div>
            </div>
            <Toaster position="bottom-right" richColors />
          </MotionConfig>
        </AppProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
function AppFooter() {
  const { tr } = useLanguage();
  return (
    <footer className="site-footer">
      <span className="footer-brand">
        Outside Together<span className="text-primary">.</span>
      </span>
      <span>{tr("A little time. A little company. A lot of Montréal.")}</span>
      <span>{tr("Made for getting out there ↗")}</span>
    </footer>
  );
}

/** Each page fades in when the route changes (Motion). */
function RouteFade({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  return <PageFade id={pathname}>{children}</PageFade>;
}
