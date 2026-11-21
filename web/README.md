# Outside Together — web front end

Mobile-first web app for finding people in Montréal for a spontaneous one-hour activity. It was generated with Lovable (TanStack Start, React 19, Tailwind 4, shadcn/ui) and exported into this folder.

It runs in two modes, chosen by `src/lib/supabase.ts`:

- **Supabase mode.** Turns on when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `web/.env.local`. The board, activity pages, join and leave, attendance, publishing, accounts (email + password and **Google**), points and the leaderboard use the real database through `src/api/supabase-backend.ts`.
- **Demo mode.** Used when no keys are set. Everything runs on the in-memory fixtures in `src/data/`, with Léa, Sami and Noa as quick-switch accounts. A reload resets it.

## Run it

From this folder (`web/`), with Node.js 20+:

```sh
npm install
cp .env.example .env.local   # optional: add your Supabase URL and anon key
npm run dev      # http://localhost:8080 (or the port Vite prints)
npm test         # Vitest: API rules, rewards, rankings, routing
npm run lint
npm run build    # Cloudflare Worker build in .output/
```

## What's in it

| Screen | Route | Notes |
| --- | --- | --- |
| Explore board | `/` | Public board, AI-style search box, type/day/time filters, niche level filter and sort, points shown before joining, "Nearest first" sort (browser location, on request) |
| Activity | `/activity/$id` | Join / leave, attendance and niche-task requests, members-only chat, Add to Google Calendar / `.ics` |
| Create | `/create` | Draft review and explicit Publish at a public place |
| Places | `/places` | Nearby niche places (location on explicit request only), one-time visit rewards |
| Rankings | `/leaderboard` | Friends, city, country and worldwide demo leaderboards |
| Rewards | `/rewards` | Credits earned from points × niche level, fictional offers |
| Profile | `/profile` | Points, credits, history and customization |

The UI is available in English and French (`src/i18n/`). In demo mode the accounts can be switched from the header.

## Points and niche level

Each activity type has a niche level from 1 to 5. Confirmed attendance earns `10 + 5 × niche_value`, once per person and activity, after two people confirm. Supabase mode confirms directly through `confirm_attendance`. Demo mode adds a creator/admin approval step. This is the rule from [PlanOff](../PlanOff.md#34-points-rule-proposal-change-it-if-you-prefer). Leaderboards rank by points. Credits are a separate spendable balance, so spending never changes the ranking.

## Supabase connection

`src/api/index.ts` is the single API the screens call. In Supabase mode it delegates to `src/api/supabase-backend.ts`, which follows [docs/BACKEND.md](../docs/BACKEND.md):

| API function | Supabase call |
| --- | --- |
| `getBoard`, `getActivity`, `getMyActivities` | `from('activity_board')` (counts only, `my_status` for the caller) |
| `getActivityTypes`, `getPublicPlaces` | `from('activity_types')`, `from('places')` |
| `joinActivity` / `leaveActivity` | `rpc('join_activity' / 'leave_activity')` |
| `confirmAttendance` | `rpc('confirm_attendance')`: returns points, or how many more people need to confirm |
| `createActivity` | `rpc('create_activity')` (the `create-activity` Edge Function can replace it later) |
| `aiSearch` | `functions.invoke('ai-search')`; until that function is deployed, keyword search over the live board |
| `signIn`, `signUp`, `signInWithGoogle`, `getMyProfile`, `getMyPoints` | Supabase Auth, `from('profiles')`, `from('points')` |
| `getLeaderboard` | `from('profiles')` ordered by `total_points` |

Backend error codes (`ACTIVITY_FULL`, `ACTIVITY_STARTED`, …) are turned into the messages the screens already translate.

**Not in the database yet.** In Supabase mode these stay empty or show "not connected yet", so fixture people never get mixed into real activities:
- group chat and participant introductions (the board hides who is going)
- niche challenges and the creator review step
- place check-in rewards
- profile customization

Reward credits are calculated from your real points, but purchases live in memory until there is a ledger table.

**Google sign-in** needs the Google provider enabled in Supabase; see [BACKEND.md](../docs/BACKEND.md#google-sign-in-setup). Add every origin the app runs on (e.g. `http://localhost:8080/**`) to Supabase's Redirect URLs.

**Location and calendar** need no keys. "Nearest first" asks the browser for one position only when chosen, rounds it to about 100 m and keeps it in memory. "Add to Google Calendar" opens a pre-filled Google Calendar event, and `.ics` works with Apple and Outlook calendars. Writing events through the Google Calendar API is a later step ([PlanOff §3.5](../PlanOff.md#35-external-apis-location-google-sign-in-calendar)).

## Notes on the Lovable export

- The activity photos were hosted by Lovable. They're now stored in `src/assets/*.jpg` so the app works offline and outside Lovable.
- `AGENTS.md`, `.lovable/` and `bun.lock` come from Lovable and are kept for reference. Use npm here; `package-lock.json` pins the installed versions.
- `src/routeTree.gen.ts` is generated by the TanStack router plugin. Don't edit it by hand.
