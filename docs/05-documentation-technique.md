# Documentation technique

## Architecture

Application web **PWA « Offline First »**, 100 % statique, sans build, en ES modules natifs :

```
index.html            shell + chargement des vendors (defer) + src/main.js (module)
manifest.webmanifest  installable (Windows, Android, iOS)
sw.js                 service worker : pré-cache du shell + cache runtime (dont modèle Vosk)
assets/               CSS + icônes PWA
data/referentiel.json référentiel initial (généré depuis l'Excel, voir scripts/)
vendor/               bibliothèques embarquées : jsPDF + autoTable, fflate (zip), Vosk (wasm+js)
models/fr-small.tar.gz modèle de reconnaissance vocale français Vosk (hors connexion)
src/
  main.js             routeur (hash), SW, indicateurs hors ligne / sauvegarde
  db.js               wrapper IndexedDB (pv-etancheite, stores: settings, meta, agents,
                      procedures, referentiel, refHistory, pvs, photos)
  store.js            couche données : CRUD, snapshot figé, archives .pvpack (chiffrement AES-GCM,
                      empreinte SHA-256), import/export dossier & global
  model.js            logique métier pure : statuts, filtrage support/famille, conformité auto,
                      conclusion auto, cohérence, état d'avancement
  docmodel.js         modèle de document neutre (blocs) partagé par les 3 exporteurs
  export/pdf.js       PDF via jsPDF + autoTable (images JPEG embarquées, keep-together, header/footer)
  export/docx.js      DOCX (OOXML) généré localement, zip via fflate, images dans word/media
  export/odt.js       ODT (ODF) généré localement, mimetype non compressé en 1re entrée
  export/common.js    résolution des photos (dataURL + dimensions), couleurs des statuts
  photos.js           capture (input[capture] / galerie) + compression canvas (≤1600 px, JPEG 0.82)
  voice.js            dictée vocale hors connexion : Vosk (wasm) + modèle FR embarqué,
                      repli Web Speech API si disponible, jamais de simulation
  demo.js             jeu de données de démonstration (étiqueté DÉMO, photos fictives marquées)
  views/              dashboard, dossiers, pv-edit (onglets), controles, referentiel-admin,
                      procedures, agents, parametres, sauvegarde, recette, aide
tests/                logic.test.mjs, docgen.test.mjs, e2e.test.mjs (jsdom + fake-indexeddb)
scripts/              import-referentiel.py (Excel → JSON)
docs/                 guides (installation, utilisateur, paramétrage, administration, technique, sauvegarde)
```

## Modèle de données (IndexedDB)

- `pvs` (clé `id`) : dossier complet — infos générales, `support`, `familleId`, `interventions[]`, `resultats{controlId:{statut,mesure,unite,commentaire,agentIds,interventionId}}`, `photos[]` (métadonnées + `blobKey`), `refOverrides` (surcharge par opération), **`referentielSnapshot`** (copie figée du référentiel à la création), `conclusion`, `synthese`, statuts, dates.
- `photos` (clé `key`) : blobs JPEG compressés + dimensions.
- `referentiel` (clé `id`) : éditions administrateur (remplacent/suppriment les entrées de `data/referentiel.json`) ; `PHASE:*` = phases personnalisées.
- `refHistory` : journal des modifications du référentiel.
- `agents`, `procedures`, `settings` (kv), `meta` (compteur de numérotation).

## Règles métier implémentées (points d'attention du CDC)

- Filtrage du référentiel par support (béton/acier/commun) et famille de procédé ; changement de support encadré (confirmation, conservation ou non des résultats hors périmètre).
- Conformité automatique **uniquement** si critère quantifié ET mesure saisie ; jamais de conclusion sans information suffisante.
- Masquage des contrôles non renseignés dans le document final (statut « Non applicable » explicite conservé).
- Photos obligatoirement rattachées (contrôle/phase/intervention), positionnées **en fin de chaque phase** dans le document, légendées, numérotées, jamais orphelines (contrôle de cohérence).
- Conclusion automatique prudente : jamais de conformité globale avec NC ou contrôles en attente.
- Snapshot figé du référentiel par dossier ; historique des modifications.
- Exports PDF/DOCX/ODT 100 % locaux, structure cohérente, en-tête/pied de page, pagination, tableaux non coupés (cantSplit / keep-together), photos non coupées de leur légende.
- Sauvegarde `.pvpack` : zip documenté (manifest.json, dossier.json[.enc], photos/*.jpg[.enc], meta.json avec SHA-256), chiffrement AES-256-GCM optionnel, vérification d'intégrité à l'import, transfert entre appareils.

## Aucun appel réseau

Aucune dépendance à un service distant : pas d'API, pas de CDN, pas de font externe, pas de télémétrie. Les seules ressources chargées sont servies depuis l'origine de l'application (et mises en cache par le service worker). La dictée vocale utilise Vosk compilé en WebAssembly avec un modèle local.

## Tests

```bash
node tests/logic.test.mjs   # 32 tests logique pure
node tests/docgen.test.mjs  # structure DOCX/ODT générés
node tests/e2e.test.mjs     # 25 tests de bout en bout (npm i jsdom fake-indexeddb requis dans le dossier de test)
```

+ page « ✅ Tests de recette » dans l'application (navigateur, fonctionne hors connexion).
