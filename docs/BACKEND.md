# Backend contract (Role B)

How the screens (A) and the AI functions (C) talk to the database. Supabase project: Postgres + Auth.

## Setup (once)

1. In the Supabase SQL editor, run [`supabase/migrations/`](../supabase/migrations/) `001_schema.sql` through `007_security_hardening.sql`, in order. **Do not run `20261121000000_core.sql`** (or `supabase/qa/core.sql`): they belong to an earlier, incompatible schema.
2. Run [`supabase/tests/role_b_smoke.sql`](../supabase/tests/role_b_smoke.sql). It should print `ROLE B SMOKE TEST PASSED` and leaves no data behind.
3. Dashboard → Authentication → Sign In / Providers → Email: **turn off "Confirm email"** (so demo accounts work instantly).
4. **Lovable:** connect it to this existing Supabase project and tell it *"use the existing tables, do not create or alter tables"*.

## Rule of thumb

- **Read** from tables/views with `supabase.from(...)`.
- **Write** only with `supabase.rpc(...)`. Direct inserts/updates are blocked (except renaming yourself).

## Auth

```js
await supabase.auth.signUp({ email, password, options: { data: { display_name: 'Léa' } } })
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()
```

A `profiles` row is created automatically on sign-up (display name = `display_name`, or the email prefix).

### Google sign-in

```js
await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
```

The same trigger (migration 002) creates a `profiles` row for Google users. It reads only `display_name` from the user metadata. Google supplies `full_name` / `name` instead, so Google users currently get their **email prefix** as `display_name`. They can rename themselves afterwards (see below). No extra migration is needed for Google OAuth.

## Google sign-in setup

1. In Google Cloud, create an OAuth client of type **Web application**.
2. Add the Supabase Auth callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI.
3. Supabase Dashboard → Authentication → Sign In / Providers → **Google**: enable it and paste the client ID and client secret.
4. Authentication → URL Configuration: add the deployed site URL and `http://localhost:8080` as redirect URLs.

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

Seed with the service role or the SQL editor (RLS doesn't apply there). [`supabase/seed.sql`](../supabase/seed.sql) holds synthetic Montréal fixtures; it has not been applied to the hosted project yet, so the hosted board is currently empty.
- `activity_types.niche_value` must be 1–5; `name` is unique.
- `places.is_public` defaults to true.
- `activities.created_by` can be `null` for seeded activities. Only the service role / SQL editor can read it.
- AI search and other reads should use `activity_board` (or explicit `activities` columns). The anon key can't read `created_by`, and `select('*')` on `activities` fails.
- Demo tip: for the confirm/points step, the activity must have **started**. Joining is closed after start, so either join a few minutes before `starts_at`, or seed a started activity together with `participants` rows (status `joined`) for the two demo accounts.
