# Outside Together

Find people in Montréal for a spontaneous one-hour activity. Anyone can browse the board. Sign in to join a session with available places or to publish a new one. After the activity, participants confirm attendance and earn more points for less common activities.

## Demo flow

1. Open the public board. Ask for something like “I have one hour Friday afternoon and want to play basketball.”
2. The assistant translates the request into filters. PostgreSQL finds activities with matching times and available places. Sign in and choose **Join** to reserve a spot. Read the updated count on refresh.
3. If there is no match, review a draft. Choose **Publish** to create it at a public place.
4. After the outing, two attendance confirmations close it and award each confirmed participant `10 + 5 × niche_value`. Later confirmations award their own points once.

## Stack

Lovable (React and Tailwind) for the planned web interface, Supabase Auth and PostgreSQL for accounts and rules, and Supabase Edge Functions for AI search and draft creation. The LLM key belongs in Supabase secrets. The browser uses only a public Supabase key. GitHub hosts the source.

## Repository layout

| Folder | Contents |
| --- | --- |
| [`web/`](web/README.md) | Lovable front end (TanStack Start, React, Tailwind), running on fixture data |
| [`supabase/`](supabase) | Schema, RPCs, seed and SQL checks |
| [`docs/`](docs) | Plan, QA checklist, Lovable brief and UML diagrams |

## Run the front end locally

```sh
cd web
npm install
npm run dev
```

The app opens at http://localhost:8080. Without keys it runs on demo data. To use the real database, copy `web/.env.example` to `web/.env.local` and set the Supabase URL and anon key; see [web/README.md](web/README.md).

## Run the backend locally

## Run the backend locally


From the repository root, run `supabase start` with the Supabase CLI and Docker available. The [migration](supabase/migrations/20261121000000_core.sql) and [seed](supabase/seed.sql) supply the database foundation and synthetic Montréal QA listings. The seed assigns the listings to a local demo owner. Public board reads and authenticated join/confirmation RPCs can already be exercised against the local database.

Run the rollback-only database check with `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/qa/core.sql`. Use the connection details printed by Supabase if the local ports or credentials differ.

The `web/` interface calls these RPCs once its Supabase keys are set. The two Edge Functions (`ai-search`, `create-activity`) are the remaining integration work. The SQL `create_activity` RPC is the transaction the future `create-activity` handler should call after validating the draft.

The Lovable interface and the two Edge Functions are planned integration work. The SQL `create_activity` RPC is the transaction the future `create-activity` handler should call after validating the draft.


## Project documents

- [Official 24-hour plan and API contracts](PlanOff.md)
- [Implementation handoff and UML exports](docs/PLAN.md)
- [Web QA and demo checklist](docs/QA-WEB.md)
- [Lovable build brief](docs/LOVABLE-BRIEF.md)
