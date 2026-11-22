# Outside Together — web front end

Mobile-first web app for finding people in Montréal for a spontaneous one-hour activity.

**Live:** https://outside-together.dehors-ensemble.workers.dev (open it, then **Sign in** → **Continue with Google**). It was generated with Lovable (TanStack Start, React 19, Tailwind 4, shadcn/ui) and exported into this folder.

The app runs on the Role B Supabase backend (migrations 001–022, see [docs/BACKEND.md](../docs/BACKEND.md)). It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `web/.env.local`; without them it shows a "Supabase is not configured" setup screen instead of the app. There is no offline demo mode.

## Run it

From this folder (`web/`), with Node.js 20+:

```sh
npm install
cp .env.example .env.local   # then add your Supabase project URL and anon/publishable key
npm run dev      # http://localhost:8080 (or the port Vite prints)
npm test         # Vitest: API layer against an in-memory Supabase client, board options, routing
npm run lint
npm run build    # Cloudflare Worker build in .output/
npx wrangler deploy --name outside-together   # publish (after `npx wrangler login` once)
```

Tests never reach the hosted project: `vitest.config.ts` blanks the Supabase variables and the API tests inject `src/test/fake-supabase.ts`.

## What's in it

| Screen | Route | Notes |
| --- | --- | --- |
| Explore | `/` | Lively "game lobby" home, search (AI when available, keyword search otherwise), filters, niche levels, nearest first |
| Map | `/map` | OpenStreetMap with photo pins per place, "Near me", nearby list |
| Places | `/places` | 22 places to visit (niche 1–6), "I'm here" GPS visits worth `10 + 5 × niche` once |
| Rankings | `/rankings` | My area, World, Friends; friend codes, invite links, friend requests |
| Season pass | `/season` | Season 1 · Go Habs Go: 20 free tiers, claimable rewards, logo / photo slots in `public/season/` |
| Shop | `/shop` | Profile pictures, frames, banners, name effects bought with credits |
| Messages | `/messages` | 1:1 chat with friends (Supabase Realtime), unread counts |
| My activities | `/profile` | Profile card (rank, grade, credits, trophies, social links), my activities with Late / Finished labels, points |
| Public profile | `/u/$id` | Someone's grade, rank, trophies and cosmetics |
| Activity | `/activity/$id` | Join / leave, "We're here" (within 200 m), side quests, organizer's validation grid, group chat, edit / delete for the creator, calendar |
| Create / edit | `/create`, `/create?edit=<id>` | Type, preset place or map pin, title, photo upload, side quests |

The UI is available in English and French (`src/i18n/`). Sign-in is Google only, through Supabase Auth.

## Points and niche level

Each activity type has a niche level from 1 to 5. Points are `10 + 5 × niche_value`, once per person and activity. Participants check themselves in with "We're here" (`confirm_attendance`) once the activity has started; when 2 participants have checked in, everyone checked in gets the points. This is the rule from [PlanOff](../PlanOff.md#34-points-rule-proposal-change-it-if-you-prefer).

## Supabase connection

`src/api/index.ts` is the single API the screens call. It delegates to `src/api/supabase-backend.ts`, which follows [docs/BACKEND.md](../docs/BACKEND.md):

| API function | Supabase call |
| --- | --- |
| `getBoard`, `getActivity`, `getMyActivities` | `from('activity_board')` (counts only, `my_status` for the caller) |
| `getActivityTypes`, `getPublicPlaces` | `from('activity_types')`, `from('places')` |
| `joinActivity` / `leaveActivity` | `rpc('join_activity' / 'leave_activity')` |
| `confirmAttendance` | `rpc('confirm_attendance')`: returns points, or how many more people need to check in |
| `createActivity` | `rpc('create_activity')` (the `create-activity` Edge Function can replace it later) |
| `aiSearch` | `functions.invoke('ai-search')`; when it doesn't answer in the expected shape, keyword search over the live board |
| `signInWithGoogle`, `getMyProfile`, `getMyPoints` | Supabase Auth, `from('profiles')`, `from('points')` |

Backend error codes (`ACTIVITY_FULL`, `ACTIVITY_STARTED`, …) are turned into the messages the screens already translate.

Shared helpers live in `src/lib/`: `types.ts` (screen data shapes), `time.ts` (Montréal date/time), `geo.ts` (distance for nearest-first), `activity-visuals.ts` (activity type → photo/pictogram), `calendar.ts`.

**Google sign-in** needs the Google provider enabled in Supabase; see [BACKEND.md](../docs/BACKEND.md#google-sign-in-setup). Add every origin the app runs on (e.g. `http://localhost:8080/**`) to Supabase's Redirect URLs.

**Location and calendar** need no keys. "Nearest first" asks the browser for one position only when chosen, rounds it to about 100 m and keeps it in memory. "Add to Google Calendar" opens a pre-filled Google Calendar event, and `.ics` works with Apple and Outlook calendars. Writing events through the Google Calendar API is a later step ([PlanOff §3.5](../PlanOff.md#35-external-apis-location-google-sign-in-calendar)).

## Notes on the Lovable export

- The activity photos were hosted by Lovable. They're now stored in `src/assets/*.jpg` so the app works offline and outside Lovable.
- `AGENTS.md`, `.lovable/` and `bun.lock` come from Lovable and are kept for reference. Use npm here; `package-lock.json` pins the installed versions.
- `src/routeTree.gen.ts` is generated by the TanStack router plugin. Don't edit it by hand.
