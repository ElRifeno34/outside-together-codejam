# Outside Together — implementation handoff

[PlanOff.md](../PlanOff.md) defines the 24-hour scope. The deliverable is a Montréal-first web demo for spontaneous one-hour activities.

## Scope and decisions

- The public board shows upcoming activities, public places and the available spots. Selecting **Join** requires an account. A search result does not reserve a place.
- The assistant returns filters. The database selects the activities. With no match, an authenticated member can review and explicitly publish a draft at a public place. A text request alone does not create it.
- Join and leave recalculate registrations in the database. The board rereads the count after a join and on refresh. Once a session starts, registrations close. An activity without its minimum at that point is ineligible for attendance and falls off the board.
- At least two confirmations after the end award `10 + 5 × niche_value` per confirmed person, once per activity. A later confirmation earns the same award once. The niche value belongs to the activity type.
- Protect public browsing and joining. At a delay, cut activity creation, then points, then chat in that order. The fallback is the plain filter form.


## 24-hour checkpoints

| Hours | A · Lovable and screens | B · Supabase and rules | C · AI, seed, pitch |
| --- | --- | --- | --- |
| 0–2 | Freeze screen flow and Git branches | Agree on SQL and Auth contracts | Agree on AI output and fixtures |
| 2–10 | Board, activity detail, auth and profile | Join validated with two accounts | Seed activities and test 20 prompts |
| 10–15 | Connect screens to Supabase | Fix permissions and capacity checks | Connect search and keyword fallback |
| 15–19 | Draft review and points display | Validate attendance and points | Connect draft creation and rehearse |
| 19–22 | Fix and test on a phone | Test with three accounts | Rehearse three times, including API failure |
| 22–24 | Freeze and rehearse the pitch | Verify the same demo version | Record the fallback demo |

One person prompts Lovable, one change at a time. Keep about 30 credits in reserve. The team stops adding features at H19.

## Implementation status

The checked-in Supabase base supplies `profiles`, `places`, `activity_types`, `activities`, `participants`, `points` and the read-only `activity_board` view. Its RPCs are `create_activity`, `join_activity`, `leave_activity` and `confirm_attendance`. The activity view exposes a count and public place fields. Individual registration and point rows are private to the account.

The web front end lives in [`web/`](../web/README.md). It calls these tables and RPCs through `web/src/api/` once `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `web/.env.local`. Without them it runs on demo fixtures. Google sign-in, "add to calendar" and "nearest first" are built. [PlanOff §3.5](../PlanOff.md#35-external-apis-location-google-sign-in-calendar) lists the external APIs and what each one needs, and [BACKEND.md](BACKEND.md#google-sign-in-setup) has the Google setup.

The Edge contracts in [PlanOff](../PlanOff.md#32-ai-contract-c-implements-a-consumes) describe the planned `ai-search` and `create-activity` handlers. Until `ai-search` is deployed, the app falls back to keyword search over the live board and shows the "fallback" banner. Interpret relative times in `America/Toronto`, validate the returned filters, and read listings from PostgreSQL. Use the [Lovable brief](LOVABLE-BRIEF.md) when building the interface. Use [QA web](QA-WEB.md) for the handoff.

## UML exports

[PlanOff](../PlanOff.md#5-uml-diagrams) also contains the Mermaid originals.


| --- | --- | --- |
| **1 · Se retrouver** | Trouver une personne ou une sortie selon l’activité, les intérêts, le secteur et les disponibilités. Entrée directe ou demande en français. | « Je veux marcher avec quelqu’un », « On étudie dehors après le cours ? », « Il nous manque une personne pour jouer au basket ». |
| **2 · Faire un détour** | Composer un parcours de 2 ou 3 arrêts et un défi photo. Une fois la première sortie validée, proposer une activité un peu plus spécialisée selon les intérêts confirmés. | Une promenade devient un inventaire de détails architecturaux. Une séance d’étude dehors devient un jeu sur les sons et les conditions de concentration. |
| **3 · Laisser une trace** | Choisir un projet de cercle. Chaque mission demande une nouvelle sortie et produit une preuve ou une observation que le groupe peut réutiliser. | **Atlas des détails oubliés** : repérer trois détails publics, retourner sur le terrain pour rédiger trois indices, puis faire tester le parcours par un autre duo. Le livrable est une fiche d’itinéraire réutilisable dans le cercle. |

**Atlas des détails oubliés** est le seul projet complet prévu pour les 36 heures. **Carte des bons coins pour étudier dehors** (Nerd Circle) et **Carnet des terrains de basket** (Basket Pickup) sont des exemples de suites. Le **LARP Circle** peut jouer la mission « faire tester les indices » sous forme d’enquête. Le cercle **Nouveaux dans le coin** peut réutiliser le parcours comme balade d’accueil.

La progression sert à recommander la prochaine sortie. Les membres peuvent toujours lancer une activité simple ou rejoindre un projet qui les intéresse. Le classement compare les membres d’une même sortie. Le projet avance en équipe, quel que soit le score individuel.

## MVP et démo


## 24-hour checkpoints

| Hours | A · Lovable and screens | B · Supabase and rules | C · AI, seed, pitch |
| --- | --- | --- | --- |
| 0–2 | Freeze screen flow and Git branches | Agree on SQL and Auth contracts | Agree on AI output and fixtures |
| 2–10 | Board, activity detail, auth and profile | Join validated with two accounts | Seed activities and test 20 prompts |
| 10–15 | Connect screens to Supabase | Fix permissions and capacity checks | Connect search and keyword fallback |
| 15–19 | Draft review and points display | Validate attendance and points | Connect draft creation and rehearse |
| 19–22 | Fix and test on a phone | Test with three accounts | Rehearse three times, including API failure |
| 22–24 | Freeze and rehearse the pitch | Verify the same demo version | Record the fallback demo |

One person prompts Lovable, one change at a time. Keep about 30 credits in reserve. The team stops adding features at H19.

## Implementation status

The checked-in Supabase base supplies `profiles`, `places`, `activity_types`, `activities`, `participants`, `points` and the read-only `activity_board` view. Its RPCs are `create_activity`, `join_activity`, `leave_activity` and `confirm_attendance`. The activity view exposes a count and public place fields. Individual registration and point rows are private to the account.

The Edge contracts in [PlanOff](../PlanOff.md#32-ai-contract-c-implements-a-consumes) describe the planned `ai-search` and `create-activity` handlers. Interpret relative times in `America/Toronto`, validate the returned filters, and read listings from PostgreSQL. Use the [Lovable brief](LOVABLE-BRIEF.md) when building the interface. Use [QA web](QA-WEB.md) for the handoff.

## UML exports

[PlanOff](../PlanOff.md#5-uml-diagrams) also contains the Mermaid originals.

| Diagram | Editable | Preview |
| --- | --- | --- |
| Public browse, login and member actions | [UXF](diagrammes/01-cas-utilisation.uxf) | [PNG](diagrammes/01-cas-utilisation.png) |
| Data model | [UXF](diagrammes/02-classes.uxf) | [PNG](diagrammes/02-classes.png) |
| Assistant search and fallback | [UXF](diagrammes/03-sequence.uxf) | [PNG](diagrammes/03-sequence.png) |
| Activity and participant states | [UXF](diagrammes/04-etats.uxf) | [PNG](diagrammes/04-etats.png) |
| Web deployment | [UXF](diagrammes/05-deploiement.uxf) | [PNG](diagrammes/05-deploiement.png) |
| Join, confirm and award | [UXF](diagrammes/06-sequence-participation.uxf) | [PNG](diagrammes/06-sequence-participation.png) |
