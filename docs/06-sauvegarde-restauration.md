# Procédure de sauvegarde et de restauration

> **Rappel essentiel** : toutes les données de l'application (dossiers, photos, référentiel, paramètres, agents) sont stockées **uniquement sur l'appareil**, dans IndexedDB. En cas de perte, vol ou panne de l'appareil, seules vos archives `.pvpack` permettent de restaurer vos dossiers. **Sauvegardez régulièrement.**

## 1. Exporter un dossier (menu 💾 ou onglet Exporter d'un PV)

- Choisir le dossier, saisir éventuellement un **mot de passe** (chiffrement AES-256-GCM).
- Télécharger `PV-XXXX_sauvegarde.pvpack`.
- Contenu : données du dossier (infos, interventions, résultats, photos, **référentiel figé utilisé**), photos JPEG, manifeste, empreinte SHA-256.

## 2. Sauvegarde globale (menu 💾)

Archive `.pvpack` contenant **tous** les dossiers, toutes les photos, les agents, les procédés, le référentiel et ses modifications, l'historique et les paramètres. À réaliser régulièrement, par exemple en fin de semaine de chantier.

## 3. Restaurer / transférer vers un autre appareil

1. Copier le fichier `.pvpack` sur le nouvel appareil (clé USB, e-mail, messagerie, cloud personnel — le fichier peut être chiffré).
2. Menu 💾 → « Importer / restaurer » : choisir le fichier, saisir le mot de passe si l'archive est chiffrée.
3. L'application vérifie l'**empreinte SHA-256** avant import : archive altérée ou mauvais mot de passe → import refusé avec message explicite.
4. Si un dossier de même numéro existe déjà : choix de **remplacer** l'existant ou de **conserver les deux** (le nouveau reçoit un numéro neuf).

## 4. Format d'archive (documenté)

```
.pvpack = ZIP
  manifest.json        { format:"pv-etancheite-backup", version:1, kind:"dossier"|"global",
                         appVersion, exportDate, encrypted:bool, photos:[{id,file,encrypted}] }
  dossier.json[.enc]   (kind=dossier) dossier PV complet + référentiel figé (snapshot)
  data.json[.enc]      (kind=global)  settings, meta, agents, procedures, referentiel, refHistory, pvs
  photos/<id>.jpg[.enc] photographies JPEG (compressées à la prise de vue)
  meta.json            { checksum: SHA-256 du fichier de données, dossierFile|dataFile }
.enc = AES-256-GCM (PBKDF2-SHA-256, 150 000 itérations, sel 16 octets + IV 12 octets en tête)
```

## 5. Bonnes pratiques

- Exporter chaque dossier **à sa finalisation** (statut « Édité »), pas seulement la sauvegarde globale.
- Conserver au moins une copie hors de l'appareil (clé USB, NAS, e-mail) — un téléphone de chantier est exposé.
- Tester la restauration d'une archive de temps en temps (importer sur un second appareil ou en double).
- En cas de doute sur l'intégrité, ne pas forcer l'import : le contrôle SHA-256 est là pour ça.
