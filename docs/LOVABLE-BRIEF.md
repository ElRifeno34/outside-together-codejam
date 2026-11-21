# Lovable brief — Outside Together web demo

Build a mobile-friendly web app for finding people in Montréal for a spontaneous one-hour activity. Follow the [24-hour scope](../PlanOff.md), [QA checklist](QA-WEB.md) and the Supabase schema in this repository.

## First prompt

> Build the public activity board and activity detail. Show the activity type, public place, Montréal start time, duration and available spots. Allow browsing without login. Provide type and time filters, plus a Join action that prompts unauthenticated visitors to sign in. Keep the screens usable on a phone and use fixture data until the database connection is ready.

## Follow-up prompts in order

1. Connect Supabase Auth and the read-only `activity_board` view. Add a minimal profile with display name and point total. Route Join through `join_activity` and reread the listing after the request.
2. Add chat using the `ai-search` response shapes from PlanOff. Show a result list with Join actions. Leave the plain filters available after a fallback.
3. Add a draft review form on `no_match`. Use verified public places and explicit Publish through `create-activity`. Show attendance and points after the end through `confirm_attendance`.

Keep requests small and send one change per prompt from the designated Lovable account. Reserve about 30 credits. Deliver the board and Join before using credits on the remaining flow. The browser needs only the public Supabase key.
