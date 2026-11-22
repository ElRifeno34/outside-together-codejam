# Outside Together

Find people in Montréal for a spontaneous one-hour activity, discover places, and earn points, credits and trophies for getting outside.

**Live site:** https://outside-together.dehors-ensemble.workers.dev

## How to access

1. Open **https://outside-together.dehors-ensemble.workers.dev** on a computer or a phone (no install needed).
2. Browse the board, the map and the places without an account.
3. Click **Sign in** → **Continue with Google** to join or create activities, check in, visit places, add friends, chat and customize your profile. Your account is created on your first sign-in.

On a phone, allow location when asked: check-ins and place visits use it to confirm you're there.

## How it works

1. **Find something to do.** Search in plain words ("basketball Friday afternoon", "chess at La Fontaine") or filter by type, day, time and niche level. The map shows every upcoming activity, with the closest ones listed under it.
2. **Join, then show up.** Once the activity starts, tap **We're here**: the phone's location must be within 200 m of the spot. When 2 people have checked in, everyone checked in earns `10 + 5 × niche level` points.
3. **Or start one.** Pick a type, a public place or any spot on the map, a time, an optional title and photo, and up to 5 side quests. The creator can edit or delete it until it starts, and validates side quests for attendees afterwards.
4. **Explore places.** 22 Montréal places, from Belvédère Kondiaronk (niche 1) to the Trottier Building at McGill (niche 6). Being within 200 m earns `10 + 5 × niche level` points, once per place.
5. **Level up.** Every 5 points give 1 credit to spend in the shop. Points also raise your grade (Bronze I to Platinum), unlock trophies, and move you up the season pass.

## Features

| Area | What's there |
| --- | --- |
| Explore | Search, filters, niche levels, nearest first, live counts, lively "game lobby" home |
| Map | OpenStreetMap map with photo pins per place, "Near me", nearby list |
| Activities | Join / leave, GPS check-in (200 m), time-aware labels (Late, Finished), add to calendar, group chat |
| Create / edit | Custom title, photo upload, preset place or map pin (address search), side quests, edit and delete before the start |
| Side quests | Suggested or custom mini-challenges, 5 × niche points each, validated by the organizer |
| Places | 22 places to visit, niche 1–6, GPS-validated visits |
| Rankings | My area (Montréal boroughs and suburbs), World, Friends |
| Friends | Friend codes and invite links, requests to accept or decline, 1:1 chat |
| Progression | Credits, grades (Bronze I–III, Silver I–III, Gold I–III, Platinum), 18 trophies with a showcase |
| Shop | Profile pictures, avatar frames, banners, name effects |
| Season pass | Season 1 · Go Habs Go: 20 free tiers with credits and season-only cosmetics |
| Profiles | Public profiles with rank, grade, trophies, cosmetics and social links |
| App | Google sign-in only, English / French, light / dark mode, sidebar (computer) and tab bar (phone), animations and confetti |

## Stack

| Layer | Technology |
| --- | --- |
| Front end | TanStack Start, React 19, Tailwind 4, shadcn/ui (first generated with Lovable) |
| Motion and effects | Motion (motion.dev), canvas-confetti, Lilita One (Google Fonts) |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim address search |
| Database and rules | Supabase PostgreSQL, row-level security, RPC functions |
| Authentication | Supabase Auth, Google sign-in only |
| Chat | Supabase Realtime |
| Photos | Supabase Storage (`activity-photos` bucket) |
| Hosting | Cloudflare Workers |
| AI (optional) | Supabase Edge Function `ai-search` |

The database is the source of truth. Points, credits, check-ins, visits, trophies and season rewards are all decided by PostgreSQL functions, never trusted from the browser.

## Repository layout

| Folder | Contents |
| --- | --- |
| [`web/`](web/README.md) | The web app |
| [`supabase/`](supabase) | Migrations 001–022, seed, smoke test, `ai-search` Edge Function |
| [`docs/`](docs) | Backend contract, implementation handoff, QA checklist, Lovable brief, UML diagrams |

## Run locally

From `web/`, with Node.js 20+:

```sh
npm install
cp .env.example .env.local   # then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:8080
npm test
```

Without the two keys the app shows a "Supabase is not configured" screen; there is no offline demo mode. Never commit `.env.local`. See [web/README.md](web/README.md) for details.

## Backend setup (Supabase)

Run every file in [`supabase/migrations/`](supabase/migrations) in the SQL editor, in order:

| Migrations | Adds |
| --- | --- |
| 001–007 | Profiles, places, activity types, activities, participants, points, the `activity_board` view, join / leave / confirm / create RPCs, security hardening |
| 008 | Check-in requires the phone within 200 m |
| 009 | Edit an activity before it starts |
| 010–012 | Google names on profiles, Google-only sign-ups, one account per email |
| 013–014 | Places to visit, areas, friends, leaderboards; niche 6 and the Trottier Building |
| 015–016 | Custom title, photo (storage bucket) and map location; delete an activity |
| 017–018 | Side quests; friend requests |
| 019 | Credits, shop, trophies, public profiles |
| 020 | Season pass, ranks on profiles, social links, chat (adds `messages` to Realtime) |
| 021–022 | Habs season theme and player-style cosmetics |

Then optionally run [`supabase/seed.sql`](supabase/seed.sql) (16 activity types, 10 public places, 14 activities, all with fixed ids; safe to re-run, with a commented rollback). [`supabase/tests/role_b_smoke.sql`](supabase/tests/role_b_smoke.sql) checks the core rules (001–007). The full contract is in [docs/BACKEND.md](docs/BACKEND.md).

### Sign-in settings

- Supabase → Authentication → Sign In / Providers: **Google** on. Turning **Email** off also stops existing email accounts from signing in (needs an org Owner or Admin; migration 011 already refuses new non-Google accounts).
- Supabase → Authentication → URL Configuration:
  - **Site URL:** `https://outside-together.dehors-ensemble.workers.dev`
  - **Redirect URLs:** that address with `/**`, plus `http://localhost:8080/**` (and any other port you develop on).
- The Google OAuth client only needs Supabase's callback (`https://<project-ref>.supabase.co/auth/v1/callback`) as its authorized redirect URI.

## Deploy (Cloudflare Workers)

The build targets Cloudflare Workers. From `web/`, after pulling the latest `main`:

```sh
npm run build                                   # reads .env.local, writes .output/
npx wrangler login                              # once per computer
npx wrangler deploy --name outside-together
```

The site is served at https://outside-together.dehors-ensemble.workers.dev (`dehors-ensemble` is the Cloudflare account's workers.dev subdomain). To test the production build locally first, run `npx wrangler dev` from `web/` after `npm run build`.

## Season assets and licensing

Season 1 uses the Montréal Canadiens' name and colours. The Canadiens name, the CH logo and "Habs" are NHL trademarks, and players' names, photos and likenesses need a licence (club, NHL / NHLPA, or the photo agency). Get permission before a public launch.

- Licensed files dropped into [`web/public/season/`](web/public/season/README.md) (`logo.png`, `players.jpg`) appear on the season page automatically.
- Player-style cosmetics use jersey numbers, not names; rename them in one SQL line once licensed.

## Security

- Browser: the Supabase URL and anon key only (row-level security protects the data).
- Google OAuth client secret: in Supabase Auth only.
- LLM API key: in Supabase Edge Function secrets only.
- All writes go through authenticated RPC functions, except renaming yourself, picking your area and uploading to your own photo folder.
- Locations sent for check-ins and visits are stored with the check-in as proof; the "Nearest first" sort rounds the position to about 100 m and keeps it in memory.

## Project documents

- [Official 24-hour plan and API contracts](PlanOff.md)
- [Backend contract](docs/BACKEND.md)
- [Implementation handoff and UML exports](docs/PLAN.md)
- [Web QA and demo checklist](docs/QA-WEB.md)
- [Lovable build brief](docs/LOVABLE-BRIEF.md)
