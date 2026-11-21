# Outside Together — des sorties iOS qui deviennent des projets de terrain

**Pitch** — Trouve les gens près de toi qui veulent marcher, étudier dehors ou jouer au basket. Si tu veux découvrir quelque chose, l’IA transforme ton humeur et ton temps libre en mini-aventure à pied. Quand une première sortie vous accroche, votre cercle peut en faire un projet de terrain en trois missions qui laisse quelque chose d’utile derrière lui.

## L’idée originale : commencer petit, puis construire ensemble

<<<<<<< Updated upstream
| Niveau | Ce que l’application propose | Exemple autour du campus |
=======
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

| Diagram | Editable | Preview |
>>>>>>> Stashed changes
| --- | --- | --- |
| **1 · Se retrouver** | Trouver une personne ou une sortie selon l’activité, les intérêts, le secteur et les disponibilités. Entrée directe ou demande en français. | « Je veux marcher avec quelqu’un », « On étudie dehors après le cours ? », « Il nous manque une personne pour jouer au basket ». |
| **2 · Faire un détour** | Composer un parcours de 2 ou 3 arrêts et un défi photo. Une fois la première sortie validée, proposer une activité un peu plus spécialisée selon les intérêts confirmés. | Une promenade devient un inventaire de détails architecturaux. Une séance d’étude dehors devient un jeu sur les sons et les conditions de concentration. |
| **3 · Laisser une trace** | Choisir un projet de cercle. Chaque mission demande une nouvelle sortie et produit une preuve ou une observation que le groupe peut réutiliser. | **Atlas des détails oubliés** : repérer trois détails publics, retourner sur le terrain pour rédiger trois indices, puis faire tester le parcours par un autre duo. Le livrable est une fiche d’itinéraire réutilisable dans le cercle. |

**Atlas des détails oubliés** est le seul projet complet prévu pour les 36 heures. **Carte des bons coins pour étudier dehors** (Nerd Circle) et **Carnet des terrains de basket** (Basket Pickup) sont des exemples de suites. Le **LARP Circle** peut jouer la mission « faire tester les indices » sous forme d’enquête. Le cercle **Nouveaux dans le coin** peut réutiliser le parcours comme balade d’accueil.

La progression sert à recommander la prochaine sortie. Les membres peuvent toujours lancer une activité simple ou rejoindre un projet qui les intéresse. Le classement compare les membres d’une même sortie. Le projet avance en équipe, quel que soit le score individuel.

## MVP et démo

| Fonction | Comportement attendu |
| --- | --- |
| **Match près de chez moi** | Créer ou rejoindre une sortie simple à un lieu public, avec créneau et capacité. En saisie libre, reconnaître la marche, l’étude dehors et le basket. Une sortie peut appartenir à un cercle public ou être accessible par code. |
| **Quête intercercles** | Recommander une quête préchargée avec 2 ou 3 arrêts vérifiés et un indice photo. La balade d’accueil des nouveaux arrivants croise une activité du LARP Circle et peut lancer l’Atlas. |
| **Projet de terrain** | Un cercle lance l’Atlas à partir d’un modèle. Les trois missions s’affichent dans l’ordre. Chaque sortie de mission est liée à un seul jalon. Le jalon suivant s’ouvre quand une première preuve de la sortie validée est approuvée par un autre participant confirmé. Les trois fiches de mission constituent le livrable. |
| **Photo et points** | Après la fin, deux confirmations distinctes valident la sortie. Chaque participant confirmé reçoit 10 points, plus 5 dehors. Dans une aventure ou un projet, un autre participant confirmé peut approuver une photo et donner 5 points à son auteur. Une preuve maximum par joueur et par sortie. |
| **Mode terrain** | La fiche téléchargée avant de partir reste lisible sans réseau dans une session Expo Go déjà chargée. Hors ligne, conserver la photo en brouillon local et attendre la reconnexion pour l’envoyer. |

**Démo jury** — Sur un iPhone, Léa demande une balade sociale de 30 minutes. Sami rejoint la sortie par code sur un deuxième iPhone. Le parcours montre deux arrêts et un indice sur un détail architectural. Une sortie terminée préchargée permet de montrer les confirmations, le score **20–15**, puis le déblocage de la deuxième mission de l’Atlas. Les étapes de terrain préchargées portent sur des lieux à vérifier avant la démo.

Le P0 tient en quatre vues iOS : **Explorer**, **Cercles** (avec la fiche projet), **Sortie** et **Profil**. Un seul secteur, quatre cercles préchargés et un modèle de projet. Les lieux du pilote et l’efficacité de la recommandation sont à vérifier en marchant. Projets libres, validation photo par vision et diffusion grand public passent après la démo.

| Priorité | Fonction | Périmètre |
| --- | --- | --- |
| **P1** | **Hidden Montréal** | Avec l’assistant existant, personnaliser les suggestions de lieux méconnus et les mini-parcours à partir de « Me détendre », « J’ai 30 minutes », « Rencontrer du monde », « Découvrir quelque chose » ou d’une demande libre. |
| **P2** | **RealLife Wrapped** | Afficher les heures dehors, les activités, les personnes rencontrées et les nouveaux lieux à partir des participations confirmées. Aucune mesure du temps d’écran n’entre dans ce bilan. |
| **Plus tard** | **Loup-garou de proximité** | Démarrer quand tous les joueurs sont proches. Garder l’état de partie côté serveur et le diffuser via Realtime. Prévoir un code ou un QR si la localisation manque de précision. |

## IA et contrats serveur

1. **Établir les critères.** Le serveur reconnaît les activités de démo et les durées à partir de raccourcis et de mots-clés. La personne confirme le départ, l’ambiance et le créneau si nécessaire. Le modèle reçoit les résultats validés et formule les recommandations et les indices.
2. **Matcher les personnes et les sorties.** Filtrer par secteur, capacité, créneau commun suffisant et absence de réservation. Classer par activité préférée, chevauchement et intérêts communs. Afficher un motif concret, par exemple « Basket · Campus · vendredi 17 h 30 ». Quand aucun groupe n’est disponible, proposer de publier un autre créneau ou de partir en solo.
3. **Calculer puis formuler le trajet.** En P0, choisir parmi les quêtes préchargées. En P1, composer 2 ou 3 arrêts distincts à partir de liaisons piétonnes vérifiées. Dans les deux cas, compter l’approche, la marche et la durée des activités. L’IA reçoit seulement le parcours retenu et rédige l’activité et l’indice. L’app affiche les lieux et les horaires validés par le serveur. Utiliser les textes du catalogue si l’IA échoue.
4. **Relier aventure et projet.** Suggérer un détour compatible avec l’intérêt choisi et les sorties validées. Pour un projet, réutiliser le même flux de sortie avec un lien vers le jalon actif. La preuve approuvée combine une photo d’un objet ou d’un lieu et une note courte montrant le résultat de la mission. Les participants du projet voient les fiches validées.
5. **Confirmer atomiquement.** Capacité et conflits d’horaire à l’inscription, crédits uniques par sortie, joueur et type, puis première approbation admissible par un pair. La transaction qui approuve une preuve de projet valide aussi le jalon s’il est actif. Plusieurs preuves acceptées peuvent créditer leurs auteurs, mais ne font progresser ce jalon qu’une fois.

### Noyau et modules d’activités

Le noyau gère comptes, cercles, sorties, inscriptions, preuves et points. Chaque module expose un **déclencheur**, des **règles** et un **résultat** validé. Par exemple, une balade démarre à l’heure convenue et rend une participation confirmée. Une quête LARP peut produire une preuve et une note de mission. Le noyau reçoit ces résultats normalisés et applique le barème commun. Ajouter le loup-garou passe par un nouveau module et sa logique de partie.

À figer à H3 : contrat de recommandation et schéma `Sortie` avec module et lieu de référence ou circuit. Préparer `Lieu` avec nom, coordonnées, étiquettes et statut méconnu ou connu. Garder un historique immuable des participations validées avec date, durée, plein air, activité et référence aux lieux visités. Le cache iOS est lié au compte et effacé à la déconnexion.

## Déploiement iOS

- **App iOS** : React Native avec Expo, `react-native-maps` pour la carte et `expo-location` seulement quand la personne lance l’activité. Utiliser la position en mémoire pour choisir le point de départ proche, puis garder uniquement l’identifiant du lieu choisi. Prévoir le choix manuel si la permission est refusée. La fiche hors ligne garde les repères en texte. [Carte](https://docs.expo.dev/versions/latest/sdk/map-view/) · [Position](https://docs.expo.dev/versions/latest/sdk/location/)
- **Supabase** : Auth, PostgreSQL et Storage privé. Les Edge Functions valident les demandes, appellent le modèle avec une clé serveur et délèguent les confirmations et crédits à des transactions PostgreSQL. Realtime signale les changements d’inscriptions, de score et de jalon aux participants autorisés. Après reconnexion, l’app relit l’état serveur. [Edge Functions](https://supabase.com/docs/guides/functions) · [Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- **Notifications** : utiliser `expo-notifications` pour un rappel local si utile. La démo repose sur les mises à jour Realtime pendant l’utilisation. Les notifications à distance et la localisation en arrière-plan sont hors périmètre de la démo. [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- **Démo sur deux iPhone** : choisir à H0 un SDK pris en charge par l’Expo Go déjà installé, puis ouvrir le projet via le QR de `npx expo start`. Tester le réseau de la salle et un tunnel ou un point d’accès de secours. Prévoir une projection de l’iPhone et des données préchargées pour l’accueil et la quête intercercles. Montrer Hidden Montréal et Wrapped seulement s’ils sont prêts. [Compatibilité Expo Go](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) · [QR et tunnel](https://docs.expo.dev/get-started/start-developing/)

## Diagrammes UML

| Diagramme | Périmètre | Fichiers |
| --- | --- | --- |
| Cas d’utilisation | Matching, aventure, jeu et projet de cercle | [UXF](diagrammes/01-cas-utilisation.uxf) · [PNG](diagrammes/01-cas-utilisation.png) |
| Classes | Catalogue, sorties, cercles, projet, jalons et preuves | [UXF](diagrammes/02-classes.uxf) · [PNG](diagrammes/02-classes.png) |
| Séquence | Demande sur iOS, sortie, preuve, points et progression | [UXF](diagrammes/03-sequence.uxf) · [PNG](diagrammes/03-sequence.png) |
| États | Cycle de la sortie, de la preuve et du jalon | [UXF](diagrammes/04-etats.uxf) · [PNG](diagrammes/04-etats.png) |
| Déploiement | QR Expo Go sur iPhone, Realtime, Edge Functions et IA | [UXF](diagrammes/05-deploiement.uxf) · [PNG](diagrammes/05-deploiement.png) |

## Plan d’implémentation sur 36 heures

| Heures | A · App iOS | B · Données, QA et déploiement | C · Matching, IA et terrain | Critère de passage |
| --- | --- | --- | --- | --- |
| **H0–H3** | Squelette iOS, QR et essai Expo Go | Comptes, schéma et contrat des modules | Secteur, quête d’accueil et trois missions de l’Atlas | QR ouvert sur deux iPhone |
| **H3–H10** | Explorer, Profil et fiche de trajet | Auth, catalogue et premières Edge Functions | Précharger et vérifier les lieux de la quête | Fiche de trajet sur iPhone |
| **H10–H18** | Cercles, rejoindre par code, cache de fiche | Places, conflits, transactions et Realtime | Matching marche/étude/basket et quête intercercles | Deux joueurs voient le même état |
| **H18–H24** | Appareil photo, classement, fiche projet | Confirmations, stockage privé, points et validation du jalon | Activité de niche, indices et solution de secours si l’IA est indisponible | Une preuve donne 5 points et ouvre une mission |
| **H24–H30** | Essai dehors sur deux iPhone et correctifs | Tests simultanés, réseau, permissions et régression | Chronométrer la quête, puis essayer Hidden Montréal si P0 est stable | Toutes les vérifications P0 passent |
| **H30–H36** | Rejouer le QR et tester la projection | Geler la version et tester le réseau de la salle | Préparer les données de démo. Afficher Wrapped si P0 et P1 sont stables | Parcours complet sur deux iPhone |

**Jalon H24** — Si le parcours n’est pas complet, garder deux circuits testés, un modèle de projet et les écrans essentiels. H24–H30 reste réservé au parcours complet, à l’essai sur le terrain et aux corrections. Le [plan QA iOS](QA-IOS.md) donne les scénarios, les résultats attendus et la décision de livraison.

## Prompt d’implémentation

> Construis Outside Together pour iOS uniquement, avec React Native/Expo et une démo par QR dans Expo Go. Utilise Supabase Auth, PostgreSQL, Storage privé, Realtime et Edge Functions. Teste le QR sur deux iPhone dès H0. Livre le matching marche/étude/basket, la quête d’accueil intercercles, le défi photo, les points et le projet Atlas en trois missions. Fais passer les activités par le contrat déclencheur, règles et résultat. Valide côté serveur les places, le créneau et les lieux. Utilise l’IA pour formuler la recommandation à partir de faits validés. Préserve l’historique de participation. Ajoute Hidden Montréal en P1 et Wrapped en P2 après validation du parcours principal.

