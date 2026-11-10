# Guide d'administration

## Gestion du référentiel de contrôles (menu 📋)

L'administrateur peut, sans développeur :

- **Ajouter / modifier / supprimer un procédé** (familles) et des procédés personnalisés ;
- **Ajouter / modifier / supprimer une phase** de contrôle ;
- **Ajouter / modifier / supprimer / dupliquer un point de contrôle**, le **déplacer** vers une autre phase (via modification de la phase) ;
- Définir les **supports compatibles** (commun / béton / acier) et la famille concernée ;
- Définir les **valeurs admissibles** : min, max, cible, tolérance, unité, ou qualitatif ; méthode de contrôle ; fréquence/échantillonnage ;
- **Associer des références contractuelles** à chaque critère (CCTP, PAQ, SOPAQ, fiche technique, DTA, ATEx, norme NF EN, guide technique, notice fabricant, plan d'exécution, autre) avec référence, version/indice, date, page, article/paragraphe, extrait de l'exigence et commentaire de justification ;
- Définir le caractère **obligatoire / facultatif** et le type **PA (point d'arrêt) / PC (point critique)**.

Toutes les modifications sont **journalisées** (date, action, avant/après) dans l'historique. La suppression d'un élément utilisé dans des PV ne supprime rien dans ces PV : chaque dossier embarque sa **copie figée** (snapshot) du référentiel.

## Import du référentiel Excel

Le référentiel livré provient du fichier `referentiel-etancheite.xlsx` (feuille « Référentiel »). Pour le régénérer ou le faire évoluer :

```bash
python3 scripts/import-referentiel.py referentiel-etancheite.xlsx data/referentiel.json
```

`data/referentiel.json` (58 points, 7 phases, 5 familles) est embarqué dans l'application et servi hors connexion.

## Sécurité des données

- Données 100 % locales (IndexedDB + blobs) ; aucune transmission réseau.
- **Sauvegardes** : archives `.pvpack` avec empreinte **SHA-256** vérifiée à l'import et **chiffrement optionnel AES-256-GCM** (PBKDF2-SHA-256, 150 000 itérations) via un mot de passe.
- Contrôle d'intégrité systématique ; import refusé si l'empreinte ne correspond pas (archive altérée ou mauvais mot de passe).

## Recette

Menu **✅ Tests de recette** : exécute dans le navigateur les tests automatisés du cahier des charges (création PV, filtrage support béton/acier, chargement procédé, modification de critère, justification documentaire, ajout/suppression de point sans altération des anciens PV, multi-interventions, masquage des vides, photo, position des photos, agents, exports PDF/DOCX/ODT, persistance, sauvegarde/restauration, conformité automatique prudente, cohérence).

Tests développeur hors navigateur :

```bash
node tests/logic.test.mjs    # logique métier (32 tests)
node tests/docgen.test.mjs   # génération DOCX/ODT (structure zip + XML)
node tests/e2e.test.mjs      # bout en bout jsdom + fake-indexeddb (25 tests ; nécessite jsdom, fake-indexeddb)
```
