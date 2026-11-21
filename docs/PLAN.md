# Outside Together — plan de hackathon en 36 heures

## Le concept

Tu veux marcher, étudier dehors ou jouer au basket, mais personne n’a lancé de plan. Outside Together trouve un créneau commun, t’oriente vers un cercle qui partage tes intérêts et propose une sortie concrète. Après la sortie, les personnes présentes confirment leur participation et gagnent des points.

**Le moment à montrer au jury** : un nouveau sur le campus, une fan de jeux de rôle et une personne qui veut prendre l’air ont 45 minutes en commun. L’assistant leur propose une **quête d’accueil** dans un parc : un membre du LARP Circle lance une mission de rôle, et le groupe fait découvrir trois repères du campus au nouveau venu. Alex peut aussi trouver un match de basket et Sami une séance d’étude dehors dans leurs cercles respectifs.

Le planning suppose trois personnes, avec une personne sur l’interface, une sur les données et les sorties, et une sur le matching, l’IA et la démo.

## Les cercles

Les membres peuvent créer ou rejoindre un cercle public, choisir son nom et ses intérêts, puis publier une sortie. Chaque cercle affiche ses prochaines sorties et ses activités favorites. Quatre cercles sont préchargés pour la démo.

| Cercle | Pour qui | Première sortie |
| --- | --- | --- |
| **Nouveaux dans le coin** | Nouveaux arrivants, nouveaux étudiants et personnes qui veulent découvrir le quartier | **Balade des repères** · Un membre fait découvrir ses trois endroits utiles ou préférés autour du campus. |
| **LARP Circle** | Fans de jeu de rôle grandeur nature et personnes curieuses | **Quête d’initiation** · Un scénario de 30 à 45 minutes au parc, avec un rôle facile à prendre pour les débutants. |
| **Nerd Circle** | Fans de jeux, de science-fiction, de casse-têtes et de séances d’étude collectives | **Boss de fin de chapitre** · 25 minutes d’étude dehors, puis chacun présente le problème qu’il a résolu. |
| **Basket Pickup** | Fans de basket qui cherchent un terrain et des partenaires | **Demi-terrain express** · Une partie courte avec un nombre de places défini et une heure de fin claire. |

## Points et idées à montrer

- **10 points par rencontre réalisée**, plus **5 points si elle se déroule dehors**. Chaque participant confirme sa propre présence après l’heure de fin. À partir de deux confirmations distinctes, chaque personne ayant confirmé reçoit ses points. Une confirmation tardive crédite uniquement la personne concernée. Une sortie annulée ou avec une seule confirmation ne rapporte aucun point.
- **Une seule attribution par personne et par sortie.** Une clé unique sur `(sortie_id, membre_id)` et une transaction rendent la validation sûre en cas de clic répété ou de confirmations simultanées.
- **Quête intercercles.** L’assistant s’appuie sur des modèles d’activités pour réunir deux intérêts compatibles autour d’une sortie, comme une balade d’accueil avec une mini-quête de LARP. La suggestion propose un lieu public, un créneau et un déroulé court. L’organisateur choisit dans quel cercle la publier.
- **Défis coopératifs si le P0 est stable.** Chaque sortie validée en plein air remplit d’une case la jauge hebdomadaire de son cercle. Autres bonus possibles : une carte souvenir « première sortie avec ce cercle » ou un mode « J’ai 30 minutes » qui préremplit l’assistant.

## Fonctionnalités et découpage

| Priorité | Fonctionnalités |
| --- | --- |
| **P0 · Démo complète** | Connexion, profil avec activités et disponibilités, création et adhésion aux cercles publics, recommandation IA en langage naturel, proposition d’une quête intercercles, publication et inscription à une sortie à plusieurs, confirmation de présence et affichage des points. |
| **P1 · Après validation à H24** | Défi coopératif par cercle, filtres par activité et jour, mode « J’ai 30 minutes », export calendrier `.ics`. |
| **P2 · Si la démo est stable** | Carte souvenir de première sortie, invitations privées, lien de partage d’une sortie, rappels. |

**Stack proposée** : Next.js pour l’interface et les routes serveur, Supabase pour l’authentification et les données, un modèle de langage appelé côté serveur. Quatre écrans suffisent : **Profil**, **Cercles**, **Découvrir** (avec l’assistant) et **Mes sorties** (avec le solde et l’historique des points). Une même page de sortie sert à s’inscrire, annuler et confirmer sa présence.

## Matching et recommandations IA

1. L’assistant extrait l’activité, la zone, la durée, l’horaire et les préférences exprimées. « Je viens d’arriver, j’ai 45 minutes jeudi après 17 h et j’aimerais marcher ou faire du jeu de rôle » peut correspondre à plusieurs activités.
2. Le serveur sélectionne les sorties avec des places libres et les cercles compatibles. Pour une nouvelle proposition, il cherche un créneau partagé avec au moins un membre compatible dans la même zone. Le score combine les affinités d’activité ou de cercle (45 %), le chevauchement des disponibilités (35 %) et les intérêts partagés (20 %).
3. L’assistant formule jusqu’à trois propositions à partir des résultats validés. Les modèles d’activités permettent de proposer une quête intercercles quand deux intérêts se combinent. Chaque proposition indique l’activité, le cercle, le lieu public, le créneau et la raison de la suggestion.
4. La publication inscrit l’organisateur. À l’inscription d’un autre membre, le serveur vérifie dans une transaction qu’il reste une place et que le membre n’a pas de sortie qui chevauche ce créneau. Si le modèle est indisponible, les sorties et les cercles restent consultables depuis « Découvrir ».

## Diagrammes UML

| Diagramme | Ce qu’il décrit | Fichiers |
| --- | --- | --- |
| Cas d’utilisation | Découvrir, créer et rejoindre un cercle, organiser une sortie et gagner des points | [UXF](diagrammes/01-cas-utilisation.uxf) · [PNG](diagrammes/01-cas-utilisation.png) |
| Classes | Membres, cercles, activités, sorties, participations et attributions de points | [UXF](diagrammes/02-classes.uxf) · [PNG](diagrammes/02-classes.png) |
| Séquence | De la recommandation IA aux confirmations et à l’attribution de points | [UXF](diagrammes/03-sequence.uxf) · [PNG](diagrammes/03-sequence.png) |
| États | Cycle de vie d’une sortie, de sa publication à sa validation ou à son annulation | [UXF](diagrammes/04-etats.uxf) · [PNG](diagrammes/04-etats.png) |

### Règles du modèle

- Un cercle a un créateur et peut compter plusieurs adhésions. Un membre ne peut adhérer qu’une fois au même cercle.
- Une sortie est rattachée à un cercle et à une activité. Un membre du cercle peut la publier, et tout membre connecté peut s’y inscrire. La capacité inclut l’organisateur. La participation associe un membre à une sortie avec au plus une confirmation de présence.
- L’organisateur peut annuler sa sortie avant le début. Les inscriptions ferment au début du créneau.
- Après l’heure de fin, la sortie passe en attente de confirmations. La deuxième confirmation la valide. La confirmation reste possible après validation pour les autres inscrits.

## Planning

| Heure | Interface | Données et serveur | Matching, IA et démo |
| --- | --- | --- | --- |
| **H0–H3** | Maquetter les quatre écrans | Définir le schéma, les statuts et le contrat d’API | Écrire le parcours de démo et choisir les lieux et activités |
| **H3–H10** | Créer les vues Profil et Cercles | Configurer l’authentification, les adhésions et les sorties | Précharger les quatre cercles et les profils de démo. Calculer les créneaux communs |
| **H10–H18** | Relier Découvrir, Assistant et les pages de sortie | Gérer la publication, les inscriptions, les places et les conflits d’horaire | Extraire les critères et générer une quête intercercles à partir des résultats |
| **H18–H24** | Ajouter la confirmation de présence et l’historique des points | Valider les sorties et attribuer les points dans une transaction | Tester le parcours de bout en bout, de la demande à la récompense |
| **H24–H30** | Ajouter la jauge du cercle, puis le mode 30 minutes | Exposer le total de sorties dehors, puis ajouter l’export calendrier | Tester le mode dégradé et préparer la mise en scène |
| **H30–H36** | Corriger les problèmes visibles | Déployer et vérifier les comptes de démo | Répéter et présenter l’accueil, la quête et l’attribution des points |

### Validation à H24

- Un membre peut créer un cercle et un second peut le rejoindre.
- Une demande en français produit une proposition compatible avec la zone, le créneau et la durée demandés.
- Deux comptes peuvent participer à une même sortie. Après sa fin, le premier clic laisse le score à zéro, le second accorde **15 points à chacun** si la sortie était dehors. Un clic répété ne crédite rien de plus.
- Une sortie complète, annulée ou en conflit avec une réservation est gérée dans l’interface.

Si un test échoue, H24–H30 sert à terminer le P0. À H36, la démo utilise une sortie à venir pour montrer l’organisation et une sortie terminée issue des données de démo pour montrer les confirmations et l’attribution des points.

