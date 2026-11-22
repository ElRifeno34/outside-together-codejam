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

- Keep all data access in `src/api/`: `index.ts` is the thin API the screens call and `supabase-backend.ts` maps the Role B tables, `activity_board` view and RPCs (docs/BACKEND.md). There is no in-memory demo backend; without Supabase configuration the root route shows a setup screen.
- Keep shared types in `src/lib/types.ts`, Montréal date/time helpers in `src/lib/time.ts`, distance in `src/lib/geo.ts` and the activity type → photo/pictogram mapping in `src/lib/activity-visuals.ts`.
- Use TanStack Query for async data reads and invalidate queries on account changes and mutations so participant and point totals remain consistent.
- Interpret activity calendar dates and times in America/Toronto using centralized conversion helpers so filters and drafts share the same timezone.
- Tests must never reach the hosted project: `vitest.config.ts` blanks the Supabase variables, and API tests inject the in-memory client from `src/test/fake-supabase.ts`.

- Keep UI translations and locale-aware formatting in `src/i18n/`, with English source strings as keys.
- Request device location only on explicit user action ("Nearest first") and never store or send coordinates.
