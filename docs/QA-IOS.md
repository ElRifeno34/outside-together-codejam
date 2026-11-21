# QA iOS — Outside Together

Le but est de confirmer sur deux iPhone que des personnes se trouvent, arrivent au bon endroit, peuvent agir dehors malgré un réseau intermittent et retrouvent ensuite le bon score et la bonne progression de projet.

## Banc de test et cadence

- **Deux iPhone physiques**, idéalement un petit écran et un modèle dont la version d’iOS diffère. Noter modèle, iOS, version du build, commit et environnement pour chaque passage. Garder un troisième compte pour les contrôles d’accès et de capacité. Apple recommande de couvrir les conditions réelles sur appareils. [Tester sur des appareils compatibles](https://developer.apple.com/help/app-review/before-submitting-for-review/test-compatible-devices/)
- **Environnement de test séparé** avec Léa, Sami et Noa (compte extérieur), un cercle pilote, une sortie à venir, une sortie terminée liée au premier jalon et une sortie presque pleine. Préparer un itinéraire de 30 min exactement, un de 31 min, un sans liaison et un lieu fermé. Les données de test doivent pouvoir être réinitialisées sans toucher à la démo.
- **Trois couches** : tests unitaires avec horloge et catalogue fixes pour le calcul du trajet, le matching et les scores. Tests d’intégration contre une base de test pour les actions concurrentes, l’accès aux photos et la progression. Test manuel à deux iPhone pour l’installation, la caméra, le hors-ligne et la sortie réelle.
- **H0–H3** : ouvrir le QR Expo Go sur les deux appareils et valider le SDK. **H18–H24** : rejouer les tests API et le parcours complet. **H24–H30** : faire le vrai trajet. **H30–H36** : rouvrir le QR depuis le réseau de la salle et vérifier le tunnel de secours et la projection.

## Cas P0

| ID | Test | Résultat attendu |
| --- | --- | --- |
| **IOS-01** | Scanner le QR dans Expo Go sur deux iPhone. Connecter Léa et Sami, fermer puis rouvrir le projet avec le réseau actif. Tester le texte agrandi et VoiceOver. | L’app ouvre le bon environnement, la session reprend et les actions essentielles restent utilisables. |
| **SOC-01** | Soumettre séparément une marche, une séance d’étude dehors et du basket. Pour chaque cas, préparer un bon match et un candidat avec horaire incompatible ou déjà réservé. | Le bon match apparaît avec activité et créneau. Le candidat incompatible est écarté. Sans match, une proposition de nouveau créneau ou de solo s’affiche. |
| **IA-01** | Demander une activité sociale puis la quête d’accueil. Relancer avec le même départ et la même durée. | Les recommandations reprennent les activités, lieux et horaires validés par le serveur. Le texte peut varier. |
| **IA-02** | Injecter une réponse mal formée, un identifiant inconnu, un délai dépassé et un trajet sans liaison. Tester les fixtures à 30 et 31 min avec une limite de 30 min. | Le trajet de 30 min est admissible et celui de 31 min est exclu. Aucune option invalide n’est publiée. Un itinéraire de secours ou un changement de durée/départ est proposé. |
| **JEU-01** | Rejoindre une même sortie à partir de deux appareils, puis envoyer deux demandes simultanées pour la dernière place. Tester aussi un code invalide et une sortie déjà commencée. | Une seule demande obtient la dernière place. L’autre voit un état « complet ». Le code invalide et l’inscription tardive sont refusés. |
| **IOS-02** | Charger la fiche, passer en mode avion et revenir au projet depuis l’arrière-plan. Prendre une photo, revenir en ligne et interrompre un premier envoi. | La fiche reste lisible dans la session en cours. Le brouillon est récupérable. La reprise manuelle envoie une seule preuve. Le changement de compte efface la fiche et le brouillon. |
| **IOS-03** | Refuser la caméra et réessayer. Tester la sélection depuis Photos puis un retour de l’app depuis l’arrière-plan. | Le refus débouche sur une option de sélection ou d’accès aux Réglages. Le flux ne se bloque pas et la photo reste associée à la bonne sortie. |
| **IOS-04** | Refuser la localisation au lancement de la sortie et sélectionner un départ manuellement. Autoriser ensuite une lecture ponctuelle. | La quête peut démarrer dans les deux cas. L’API reçoit l’identifiant du lieu choisi. Les coordonnées de l’iPhone sont absentes des requêtes et des données conservées. |
| **LIVE-01** | Rejoindre avec Sami pendant que Léa regarde la sortie. Couper le réseau de Léa, faire évoluer l’état, puis rétablir la connexion. | Léa voit les places et le score à jour sans rafraîchir après un événement normal. La reconnexion relit l’état serveur et rattrape les événements manqués. |
| **JEU-02** | Confirmer une présence, puis la seconde. Répéter les clics et envoyer deux approbations simultanées sur la même preuve. Tenter de s’autoapprouver et demander la photo avec Noa. | Points 0–0, puis 15–15, puis 20–15 après approbation. Les rejouements ne changent pas le total. L’autoapprobation et l’accès hors partie sont refusés. |
| **PROJ-01** | Tenter d’ouvrir le deuxième jalon avant approbation. Approuver deux preuves admissibles pour le premier jalon, puis rejouer l’événement. | Le deuxième jalon s’ouvre une fois, le troisième reste en attente et les deux preuves peuvent créditer leurs auteurs. La fiche commune conserve le résultat de la mission. |
| **TERRAIN-01** | Deux personnes suivent le circuit avec leur téléphone rangé entre les arrêts. Chronométrer l’approche, la marche et les activités. Demander à chacune quel endroit elle a découvert et si l’activité a facilité un échange. | Les arrêts sont praticables et trouvables à partir des consignes. Le trajet complet tient dans le budget annoncé. Les deux participants peuvent nommer une découverte et décrire un échange. Ajuster les durées ou les consignes avant la démo si nécessaire. |

## Décision de livraison

Consigner chaque résultat dans une fiche courte : `ID · build · appareil/iOS · résultat · preuve · responsable`. Tout échec d’installation, accès photo non autorisé, crédit doublé, jalon sauté ou échec du parcours principal bloque la validation du build. Corriger, rejouer le cas, puis refaire le parcours complet sur deux appareils. Si une route terrain rate le budget, retirer la route ou corriger son estimation et la remarcher.

Conserver une sortie terminée préchargée et un circuit déjà vérifié pour la démonstration. La sortie préchargée sert à montrer les validations en quelques minutes. Le test terrain, réalisé séparément, reste la preuve que le parcours fonctionne dehors.

Si **Hidden Montréal** est prêt, essayer les quatre intentions et vérifier les 2 ou 3 arrêts et le budget. Si **Wrapped** est prêt, vérifier les totaux à partir de participations confirmées connues : heures dehors, activités, personnes rencontrées et nouveaux lieux.

