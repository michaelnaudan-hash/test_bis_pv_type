# PV Étanchéité OA — Procès-verbaux de contrôle de mise en œuvre des étanchéités sur ouvrages d'art

Application web **métier, autonome et 100 % hors connexion** (PWA installable Windows / tablette / Android / iOS) pour constituer, renseigner et générer des procès-verbaux de contrôle des systèmes d'étanchéité sur ponts et ouvrages d'art — à partir du référentiel Excel fourni (58 points de contrôle, 7 phases, 5 familles de procédés, supports béton/acier).

## Démarrage rapide

```bash
cd pv-etancheite
python3 -m http.server 8080
# ouvrir http://localhost:8080/  (premier chargement en ligne, puis installable et utilisable hors ligne)
```

## Fonctionnalités principales

- **Offline First** : service worker + IndexedDB + stockage local des photos ; aucun appel réseau ; installable (PWA).
- **Dossiers PV** : création, recherche, reprise, duplication, archivage, suppression, états (préparation → en cours → à compléter → finalisé → édité).
- **Saisie chantier** : contrôles par phase/rubrique, statuts (Conforme / Non conforme / Sous réserves / N/A / En attente), mesures avec conformité automatique **uniquement si critère quantifié**, commentaires en dictée vocale **hors connexion (Vosk embarqué)**.
- **Support béton/acier** : filtrage automatique du référentiel ; changement encadré.
- **Photos** : prise de vue directe, compression intelligente, stockage local, légendes (clavier ou 🎙️), rattachement obligatoire, **photos intégrées en fin de chaque phase du document**.
- **Documents** : génération locale **PDF / Word (.docx) / LibreOffice (.odt)** — page de garde, tableaux, en-tête/pied de page, pagination, photos légendées dans le corps, conclusion automatique prudente (jamais conforme globale avec NC/en attente), signatures.
- **Administration** : référentiel entièrement modifiable (valeurs, unités, méthodes, fréquences, justifications documentaires CCTP/PAQ/AT…, PA/PC, obligatoire/facultatif), historique des modifications, **copie figée par dossier**, agents par rôle, procédés personnalisés, paramètres (logo, couleurs, pied de page).
- **Sauvegarde** : archives `.pvpack` documentées, empreinte SHA-256, **chiffrement AES-256-GCM optionnel**, restauration et transfert entre appareils.
- **Démo** : jeu de données clairement étiqueté DÉMO (3 interventions, photos fictives marquées).

## Structure

Voir [docs/05-documentation-technique.md](docs/05-documentation-technique.md). Guides : [installation](docs/01-installation.md), [utilisateur](docs/02-guide-utilisateur.md), [paramétrage](docs/03-guide-parametrage.md), [administration](docs/04-guide-administration.md), [sauvegarde/restauration](docs/06-sauvegarde-restauration.md).

## Tests

```bash
node tests/logic.test.mjs    # logique métier (32 tests)
node tests/docgen.test.mjs   # génération DOCX/ODT
node tests/e2e.test.mjs      # bout en bout headless (nécessite jsdom + fake-indexeddb)
# + page « ✅ Tests de recette » dans l'application (navigateur, hors connexion)
```

## Modèle de PV exemple

Un procès-verbal exemple (données fictives) est fourni dans [docs/exemples/](docs/exemples/) : `PV-exemple.pdf`, `PV-exemple.docx`, `PV-exemple.odt` — générés par le pipeline réel de l'application (page de garde, tableaux, photos intégrées par phase, conclusion, signatures).

## Référentiel

`data/referentiel.json` est généré depuis le fichier Excel livré :

```bash
python3 scripts/import-referentiel.py referentiel-etancheite.xlsx data/referentiel.json
```

Les valeurs du référentiel sont **indicatives** (Fascicule 67-I, Fascicule 65, MEMOAR X-1) ; les valeurs contractuelles (CCTP, PAQ, avis technique du procédé) priment et sont paramétrables.

## Licence des composants embarqués

- jsPDF (MIT), jspdf-autotable (MIT), fflate (MIT), Vosk + vosk-browser (Apache-2.0), modèle `vosk-model-small-fr-0.22` (Apache-2.0).
