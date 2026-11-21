# Outside Together

Find people near you for a spontaneous 1-hour activity. Tell the AI when you're free and what you feel like doing, and it matches you with the closest activity, or creates one for others to join.

Launching in **Montréal** first, other cities once it works.

## How it works

1. Anyone can **browse** activities (no account needed).
2. A person types a request, for example: *"I have 1 hour on Friday afternoon, I want to play basketball."*
3. The AI turns the request into filters (activity, day, time).
4. The app finds the closest activity with other people and **adds you to it**.
5. If there is none, an activity is **created** and the participant count updates as people join.
6. **Creating an account is required to join.**
7. After the activity, participants confirm it happened and earn **points based on how niche the activity is**.

## Features

<<<<<<< Updated upstream
- Public activity board
- Account creation and login
- Conversational AI search (request → filters → matches)
- Join an activity, with live participant count and capacity
- Create an activity when no match exists
- Points system weighted by activity rarity ("niche value")
=======
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
>>>>>>> Stashed changes

## Tech stack

| Part | Tool |
|---|---|
| Front end | Lovable (React + Tailwind) |
| Database and login | Supabase (PostgreSQL + Auth) |
| Server logic | Supabase Edge Functions |
| AI | LLM API, called only from the Edge Function |
| Hosting | Lovable publish (or Vercel) |
| Code | GitHub |

<<<<<<< Updated upstream
The database is the source of truth for places, times and counts. The AI only interprets the request and phrases the reply, so it cannot invent activities.
=======
The `web/` interface calls these RPCs once its Supabase keys are set. The two Edge Functions (`ai-search`, `create-activity`) are the remaining integration work. The SQL `create_activity` RPC is the transaction the future `create-activity` handler should call after validating the draft.
>>>>>>> Stashed changes

## Data model (simplified)

- **users**: account and profile
- **places**: verified public locations
- **activities**: type, place, start time, capacity, niche value
- **participants**: who joined which activity, confirmation status
- **points**: points earned per user per activity (once per activity)

## Setup

```bash
git clone <repo-url>
cd outside-together
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run dev
```

Edge Function secrets (set in Supabase, never in the front end):

- `LLM_API_KEY`

## Team

| Role | Owns |
|---|---|
| A | Screens and user flow (Lovable) |
| B | Database, login, join and points rules (Supabase) |
| C | AI request handling, seed data, pitch |

## Demo path

Request → AI suggests an activity → create account → join → count updates → confirm → points.

## Roadmap

- Real two-person confirmation and no-show handling
- Safety features: verified public places, university-email sign-up, report and block
- French and English interface
- Indoor and winter-friendly activities
- Recaps and badges
- More cities
