# Outside Together

Find people in Montréal for a spontaneous one-hour activity. Anyone can browse the board. Sign in to join a session with available places or to publish a new one. Once the activity starts, participants confirm attendance and earn more points for less common activities.

## Demo flow

1. Open the public board. Ask for something like “I have one hour Friday afternoon and want to play basketball.”
2. The app turns the request into filters and PostgreSQL supplies the matching activities with available places. (Today this runs through the keyword fallback; see [AI search](#ai-search).) Sign in and choose **Join** to reserve a spot. The board shows the updated participant count.
3. If there is no match, review a draft and choose **Publish** to create it at a public place.
4. Once the activity has started, participants can confirm attendance. When at least two participants have confirmed, points unlock and each confirmed participant earns `10 + 5 × niche_value`. Later confirmations earn the same award, once per person per activity.

## Stack

| Layer | Technology |
| --- | --- |
| Front end | Lovable (TanStack Start, React, Tailwind) |
| Database and rules | Supabase PostgreSQL, row-level security, RPC functions |
| Authentication | Supabase Auth, Google sign-in only |
| AI | Supabase Edge Function `ai-search` + LLM API |
| Code | GitHub |

The database is the source of truth for activities, places, times, capacity, participants and points. The AI only interprets requests into filters; it never invents activities.

## Repository layout

| Folder | Contents |
| --- | --- |
| [`web/`](web/README.md) | Lovable front end on the Supabase backend (shows a setup screen when its keys are missing) |
| [`supabase/`](supabase) | Role B migrations and RPCs, smoke test, seed, `ai-search` Edge Function |
| [`docs/`](docs) | Backend contract, implementation handoff, QA checklist, Lovable brief and UML diagrams |

## Run the front end locally

```sh
cd web
npm install
npm run dev
```

The app opens at http://localhost:8080.

Copy `web/.env.example` to `web/.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The app reads `activity_board` and writes through the RPCs. Without these keys it shows a "Supabase is not configured" screen; there is no offline demo mode.

Never commit `.env.local` or private credentials. See [web/README.md](web/README.md).

## Backend (Role B)

The backend is the Supabase project described in [docs/BACKEND.md](docs/BACKEND.md), which is the authoritative frontend/backend contract.

Setup:

1. In the Supabase SQL editor, run `supabase/migrations/001_schema.sql` through `010_google_profile_names.sql`, in order (see [docs/BACKEND.md](docs/BACKEND.md#setup-once)).
2. Run [`supabase/tests/role_b_smoke.sql`](supabase/tests/role_b_smoke.sql), the authoritative Role B database test. It should print `ROLE B SMOKE TEST PASSED` and leaves no data behind.
3. Optionally run [`supabase/seed.sql`](supabase/seed.sql) to load development data (see below).

Migrations 001–007 define `profiles`, `places`, `activity_types`, `activities`, `participants`, `points`, the public `activity_board` view and the RPCs `create_activity`, `join_activity`, `leave_activity` and `confirm_attendance`.

`supabase/seed.sql` adds 16 activity types, 10 public Montréal places and 14 upcoming activities, all with fixed ids. It has been applied to the hosted project, is safe to re-run, and ends with a commented rollback that removes only its own rows.

## AI search

A first version of the `ai-search` Edge Function is checked in under `supabase/functions/ai-search/`. It sends the sentence and today's date (America/Toronto) to the LLM and currently returns **only the parsed filters**. It does not yet query the database or return the `match` / `no_match` / `fallback` response described in [PlanOff §3.2](PlanOff.md#32-ai-contract-c-implements-a-consumes). The front end therefore treats it as unavailable and uses its **keyword fallback** over the live board.

## Activity creation

No `create-activity` Edge Function exists yet. The front end creates activities by calling the SQL `create_activity` RPC directly. A future `create-activity` Edge Function would validate an AI draft and call that same RPC with the user's JWT.

## Frontend integrations

- Google sign-in through Supabase Auth (the only way to sign in or create an account)
- English/French interface
- Add-to-calendar: Google Calendar link and `.ics` download
- Optional browser geolocation for nearest-first sorting

The Google Calendar API and maps are later features.

## Security

- Browser: Supabase URL and anon key only.
- Google OAuth client secret: Supabase Auth configuration.
- LLM API key: Supabase Edge Function secrets.
- Database writes go through authenticated RPC functions, not direct browser table writes (except renaming your own profile).

## Project documents

- [Official 24-hour plan and API contracts](PlanOff.md)
- [Backend contract](docs/BACKEND.md)
- [Implementation handoff and UML exports](docs/PLAN.md)
- [Web QA and demo checklist](docs/QA-WEB.md)
- [Lovable build brief](docs/LOVABLE-BRIEF.md)
