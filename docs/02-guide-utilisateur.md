# Guide utilisateur

## Créer un procès-verbal

1. **Tableau de bord → « Créer un nouveau PV »** (ou menu Dossiers → « Nouveau PV »).
2. Renseigner : intitulé de l'opération, nom de l'ouvrage, localisation, **support (Béton / Acier)** et **famille de procédé** (FPM/FPA, asphalte, SEL, SESM, MHC).
   - Le choix du support **filtre automatiquement** les contrôles proposés : béton → contrôles béton + communs ; acier → acier + communs. Changer de support en cours de saisie affiche une confirmation et ne supprime jamais silencieusement les données (elles sont conservées mais masquées du PV).
   - La famille de procédé charge la liste des contrôles spécifiques (ex. contrôles SEL pour un système liquide).
3. Le dossier est enregistré automatiquement (indicateur « Enregistré ✓ (local) » en haut).

## Renseigner les informations générales

Onglet **📋 Général** : maître d'ouvrage, maître d'œuvre, entreprises, lot, nature des travaux, procédé précis, fabricant, référence commerciale, références documentaires, météo, observations générales. Bouton « Préremplir depuis le dernier dossier » pour éviter les ressaisies.

## Gérer plusieurs dates d'intervention

Onglet **📅 Interventions** : ajouter autant de dates que nécessaire (date, heure, description, agents contrôle, représentants client, observations). Chaque contrôle et chaque photo peut être rattaché à une date précise.

## Saisir les contrôles

Onglet **✅ Contrôles** : les points sont présentés par phase et par rubrique, avec code, badges PA/PC, critère d'acceptation (valeur **indicative** du référentiel), méthode, fréquence, source.

Pour chaque point :
- **Statut** : Conforme / Non conforme / Conforme sous réserves / Non applicable / En attente de contrôle (boutons tactiles).
- **Mesure** : si le critère est quantifié (min/max/plage/cible + unité), la conformité est **proposée automatiquement** ; sinon elle n'est jamais déduite — vous choisissez le statut. Une mesure sans critère quantifié n'entraîne aucune conclusion automatique.
- **Commentaire** : saisie clavier ou **dictée vocale 🎙️** (hors connexion, moteur Vosk embarqué ; le texte reconnu reste modifiable).
- **Agent responsable** et **date d'intervention liée** (listes déroulantes alimentées par l'espace Agents).
- **📷 Ajouter une photo** directement rattachée au contrôle ; bouton « Point suivant ➡️ » pour enchaîner rapidement.

Option « Afficher aussi les contrôles non renseignés » (paramètres) : les voir dans l'interface sans les intégrer au document final. **Dans le PV généré, seules les rubriques renseignées apparaissent** (un point « Non applicable » explicitement choisi apparaît).

## Photographies

Onglet **📷 Photos** : prendre une photo (appareil photo) ou importer une image. Chaque photo est **obligatoirement rattachée** à une phase, un contrôle ou une date d'intervention (contrôle de cohérence). Compression automatique (JPEG ≤ 1600 px, qualité rapport technique) pour maîtriser le poids. Légende modifiable (clavier ou 🎙️), suppression, remplacement, réordonnancement (⬅️ ➡️).

**Dans le document généré, les photos figurent en fin de chaque phase concernée**, numérotées et légendées — jamais regroupées en annexe générale.

## Conclusion

Onglet **📝 Conclusion** : conclusion automatique générée à partir des résultats (comptage par statut). Elle **ne déclare jamais l'ouvrage globalement conforme** si des contrôles sont non conformes ou en attente. Elle est modifiable, complétée par une synthèse manuelle (dictée possible).

## Générer le document

Onglet **📄 Exporter** : **PDF**, **Word (.docx)**, **LibreOffice (.odt)** — génération 100 % locale. Le document comporte : page de garde (logo, société), informations générales, intervenants, dates d'intervention, référentiel figé utilisé + justifications documentaires, synthèse des contrôles, chapitres par phase avec fiches détaillées et photos intégrées, conclusion, espace signatures. En-tête (nom de l'opération), pied de page, pagination automatique. Après export, le dossier passe en statut « Édité ».

## Rechercher, dupliquer, archiver, supprimer

Menu **📁 Dossiers / PV** : recherche par n°, opération, ouvrage, date ; reprise d'un PV en cours ; duplication ; archivage ; suppression après confirmation ; export documentaire direct ; sauvegarde archive.

## Jeu de démonstration

Tableau de bord → « Générer le dossier de démonstration » : crée un dossier **clairement étiqueté DÉMO** (données et photos fictives, visiblement marquées) avec 3 dates d'intervention, plusieurs phases renseignées et 6 photos légendées.
