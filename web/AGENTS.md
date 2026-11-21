<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Front-end architecture

- Keep fixture-backed, latency-simulating data access in `src/api/` and typed seed data in `src/data/fixtures.ts`; this isolates the UI for a later service replacement.
- Fake session and mutations live only in module memory and are exposed through the app provider; no browser storage or real service is involved.
- Use TanStack Query for async data reads and invalidate queries on account changes and mutations so participant and point totals remain consistent.
- Interpret activity calendar dates and times in America/Toronto using centralized conversion helpers so filters and drafts share the same timezone.
- Keep leaderboard geography and friendship demo fixtures separate from database-shaped profiles; merge current earned totals through the async API and use shared competition ranks for tied scores.
- Pass time-relative board fixture snapshots through loader data for the initial render; independently seeded server and browser timestamps otherwise cause hydration mismatches.

- Keep UI translations and locale-aware formatting in `src/i18n/`, with English fixture identifiers unchanged; language switches must not reset the fake session or alter activities.
- Keep challenge definitions and demo introductions in `src/data/community.ts`; enforce chat membership and one-time challenge awards in the mock API so all screens share consistent access and totals.
- Keep the reward catalog and credit conversion in `src/data/rewards.ts`; award credits alongside idempotent point awards and debit an account-scoped ledger for purchases so spending never changes ranking totals.
- Keep demo roles separate from profiles and attendance/task requests in the mock API; only the event creator or demo admin may review others' requests, and rewards require approved attendance and task claims.
- Keep place niche metadata and distance helpers in `src/data/place-discovery.ts`; request device location on explicit user action, do not retain coordinates, and award each account/place visit once after a fresh proximity check in the demo API.
