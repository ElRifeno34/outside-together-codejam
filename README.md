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

- Public activity board
- Account creation and login
- Conversational AI search (request → filters → matches)
- Join an activity, with live participant count and capacity
- Create an activity when no match exists
- Points system weighted by activity rarity ("niche value")

## Tech stack

| Part | Tool |
|---|---|
| Front end | Lovable (React + Tailwind) |
| Database and login | Supabase (PostgreSQL + Auth) |
| Server logic | Supabase Edge Functions |
| AI | LLM API, called only from the Edge Function |
| Hosting | Lovable publish (or Vercel) |
| Code | GitHub |

The database is the source of truth for places, times and counts. The AI only interprets the request and phrases the reply, so it cannot invent activities.

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
