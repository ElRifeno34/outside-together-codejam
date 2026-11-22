# Backend contract (Role B)

How the screens (A) and the AI functions (C) talk to the database. Supabase project: Postgres + Auth.

## Setup (once)

1. In the Supabase SQL editor, run [`supabase/migrations/`](../supabase/migrations/) `001_schema.sql` through `011_google_only_signups.sql`, in order. 001–007 are the Role B schema; 008 adds location check-in, 009 activity editing, 010 Google profile names, 011 refuses non-Google sign-ups.
2. Run [`supabase/tests/role_b_smoke.sql`](../supabase/tests/role_b_smoke.sql), the authoritative Role B database test. It should print `ROLE B SMOKE TEST PASSED` and leaves no data behind.
3. Dashboard → Authentication → Sign In / Providers: enable **Google** (see [Google sign-in setup](#google-sign-in-setup)) and **turn Email off**. Sign-in is Google only.
4. **Lovable:** connect it to this existing Supabase project and tell it *"use the existing tables, do not create or alter tables"*.

## Rule of thumb

- **Read** from tables/views with `supabase.from(...)`.
- **Write** only with `supabase.rpc(...)`. Direct inserts/updates are blocked (except renaming yourself).

## Auth (Google only)

```js
await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/` } })
await supabase.auth.signOut()
```

There is no email/password sign-in. The app redirects to the bare origin (which matches the Redirect URLs allow list) and remembers the page it came from in `sessionStorage`, then returns there once the session is restored.

A `profiles` row is created automatically on first sign-in (trigger from 002, updated in 010): display name = Google's `full_name` / `name`, else the email prefix. People can rename themselves afterwards (see below).

## Google sign-in setup

1. Google Cloud → APIs & Services → **OAuth consent screen**: External, app name, support email; scopes `email`, `profile`, `openid`. In Testing mode only listed test users can sign in, so add testers or publish the app.
2. Credentials → **Create OAuth client ID** → Web application. Authorized JavaScript origins: every address the app runs on (e.g. `http://localhost:8080`, `http://localhost:8081`, the deployed site). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase Dashboard → Authentication → Sign In / Providers → **Google**: enable it and paste the client ID and client secret. Turn **Email** off so nobody can create a password account through the API. (This needs an org Owner/Admin; migration 011 already refuses new non-Google accounts at the database, but only the switch stops existing email accounts from signing in.)
4. Authentication → URL Configuration: Site URL = the main address; Redirect URLs = each address with `/**` (e.g. `http://localhost:8080/**`).

The Google client secret lives only in the Supabase configuration, never in frontend code or committed environment files.

## Reading

### `activity_board` (view): use this for the board, activity page and AI search

Readable by everyone, logged in or not. It shows **how many** people are going (aggregate counts), never **who**: no participant or creator ids are exposed.

| Column | Notes |
|---|---|
| `id`, `type_id`, `place_id` | uuids |
| `is_mine` | `true` if the logged-in caller created it, `false` if someone else did, `null` when logged out or for seeded activities |
| `activity_name`, `niche_value`, `keywords` | from the activity type |
| `points_value` | points a participant earns: `10 + 5 × niche_value` |
| `place_name`, `place_address`, `lat`, `lng` | from the place |
| `starts_at`, `ends_at`, `duration_min` | timestamps (UTC) |
| `capacity`, `min_people` | |
| `participant_count`, `spots_left`, `is_full` | live counts (joined + confirmed) |
| `status` | `open` · `done` · `cancelled` |
| `my_status` | caller's status: `joined` · `confirmed` · `null` (not joined / logged out) |

```js
// upcoming open activities
supabase.from('activity_board').select('*')
  .eq('status', 'open').gte('starts_at', new Date().toISOString()).order('starts_at')

// my activities
supabase.from('activity_board').select('*').not('my_status', 'is', null)

// activities I created
supabase.from('activity_board').select('*').eq('is_mine', true)
```

> **For A: don't query `created_by`.** Browser roles can't read `activities.created_by` (it would reveal who is going where). `select('created_by')` fails, and so does `select('*')` on the `activities` table. Use `activity_board.is_mine` instead. If you read `activities` directly, list the columns explicitly.

### Other tables

| Table | Who can read |
|---|---|
| `profiles` (`id`, `display_name`, `total_points`) | everyone (good for a leaderboard) |
| `places`, `activity_types` | everyone |
| `activities` (`id`, `type_id`, `place_id`, `starts_at`, `duration_min`, `capacity`, `min_people`, `status`, `created_at`) | everyone, **except `created_by`**; list columns explicitly, no `select('*')` |
| `participants` | only your own rows |
| `points` (`activity_id`, `amount`, `created_at`) | only your own rows |

Rename yourself: `supabase.from('profiles').update({ display_name }).eq('id', user.id)`

## Writing (RPC functions)

All return JSON in `data`. On failure, `error.message` is one of the **error codes** below.

**Logged-in users only.** Logged-out (anon) callers get a Postgres permission error (`error.code === '42501'`, `permission denied for function …`) instead of `NOT_AUTHENTICATED`. Check `supabase.auth.getSession()` before calling, and treat `42501` the same as `NOT_AUTHENTICATED`.

### `join_activity({ p_activity_id })`
→ `{ activity_id, my_status: 'joined', participant_count, spots_left }`
Checks: logged in, activity open, not started yet, not already in, not full. Safe when two people grab the last spot at once (only one gets it).

### `leave_activity({ p_activity_id })`
→ `{ activity_id, my_status: 'left', participant_count, spots_left }`
Only before the activity starts. You can re-join later.

### `confirm_attendance({ p_activity_id })`
→ `{ activity_id, my_status: 'confirmed', confirmed_count, points_unlocked, waiting_for, points_earned, total_points }`
- Allowed once the activity has **started** (`starts_at` passed).
- Points unlock when **2+ participants** confirm. Then everyone confirmed gets `10 + 5 × niche_value`, once. Later confirmers get their points immediately.
- Clicking twice is harmless.
- UI hint: if `points_unlocked` is false, show *"Waiting for {waiting_for} more person to confirm"*.

### `create_activity({ p_type_id, p_place_id, p_starts_at, p_duration_min?, p_capacity?, p_min_people? })`
→ `{ activity_id, my_status: 'joined', participant_count: 1, spots_left }`
Defaults: 60 min, capacity 6, min 2. Place must be public, time in the future, duration 15–240, capacity 2–20. The creator is joined automatically.
The web front end currently calls this RPC directly; no `create-activity` Edge Function exists yet.
**For C:** a future `create-activity` Edge Function can just validate the draft and call this RPC with a client built from the **user's JWT** (`Authorization` header), not the service role, so the right person is the creator.

## Error codes

| Code | Meaning / suggested UI text |
|---|---|
| `NOT_AUTHENTICATED` (or code `42501` when logged out) | Show the sign-up / log-in screen |
| `ACTIVITY_NOT_FOUND` | "This activity no longer exists" |
| `ACTIVITY_CLOSED` | "This activity is finished or cancelled" |
| `ACTIVITY_STARTED` | "This activity has already started" |
| `ACTIVITY_NOT_STARTED` | "You can confirm once the activity has started" |
| `ALREADY_JOINED` | "You're already in" |
| `ACTIVITY_FULL` | "This activity is full" |
| `NOT_A_PARTICIPANT` | "You haven't joined this activity" |
| `INVALID_TYPE` / `INVALID_PLACE` / `INVALID_TIME` / `INVALID_DURATION` / `INVALID_CAPACITY` | create-activity validation |

## For C: seed data

Seed with the service role or the SQL editor (RLS doesn't apply there). [`supabase/seed.sql`](../supabase/seed.sql) adds 16 activity types, 10 public Montréal places and 14 upcoming activities with fixed ids (`7e000000-…`, `91ace000-…`, `ac700000-…`) and `created_by = null`. It has been applied to the hosted project. It is safe to re-run, and its commented rollback deletes only those fixed ids. Because the activity ids are fixed, refresh the board before a demo by running the rollback and then the seed again.
- `activity_types.niche_value` must be 1–5; `name` is unique.
- `places.is_public` defaults to true.
- `activities.created_by` can be `null` for seeded activities. Only the service role / SQL editor can read it.
- AI search and other reads should use `activity_board` (or explicit `activities` columns). The anon key can't read `created_by`, and `select('*')` on `activities` fails.
- Demo tip: for the confirm/points step, the activity must have **started**. Joining is closed after start, so either join a few minutes before `starts_at`, or seed a started activity together with `participants` rows (status `joined`) for the two demo accounts.
