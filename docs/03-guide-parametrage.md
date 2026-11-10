# Guide de paramétrage

## Paramètres généraux (menu ⚙️)

| Paramètre | Rôle |
|---|---|
| Nom de la société | Page de garde et en-tête des documents |
| Logo | Image embarquée sur la page de garde (PDF/DOCX/ODT) |
| Couleur principale | Titres, en-têtes, tableaux des documents générés |
| Contacts | Affichés dans les informations de pied de page selon vos choix |
| Pied de page | Texte de pied de page des documents |
| Préfixe de numérotation | Numéros auto des PV : `PREFIX-Année-NNN` (ex. `PV-2025-001`) |
| Afficher les non renseignés | Option de travail (masqués du document final quoi qu'il arrive) |

## Agents & intervenants (menu 👥)

Deux catégories : **Client** (représentants du maître d'ouvrage) et **Contrôle** (chargés de contrôle/suivi). Champs : nom, prénom, fonction, société, rôle, coordonnées (tél/e-mail). Les listes déroulantes des PV (par phase/intervention) sont alimentées automatiquement ; plusieurs agents peuvent être sélectionnés par intervention.

## Procédés d'étanchéité (menu 🧪)

Les **5 familles livrées** (issues du référentiel Excel) portent chacune leur liste de contrôles :

- **FPM/FPA** — feuilles bitumineuses préfabriquées (béton ✔, acier selon AT)
- **ASP** — asphalte coulé bi/monocouche (béton ✔, acier selon AT)
- **SEL** — étanchéité liquide (béton ✔, acier selon AT)
- **SESM** — complexe épais sur tablier acier (acier ✔, béton selon AT)
- **MHC** — membrane + couche hydrocarbonée (béton ✔, acier selon AT)

Ajoutez vos **procédés/systèmes personnalisés** (nom, famille associée, fabricant, référence commerciale, avis technique, cahier de pose) : ils alimentent le champ « procédé retenu » des PV.

## Valeurs du référentiel (menu 📋)

Chaque point de contrôle peut être modifié : critère d'acceptation, **valeur contractuelle applicable** (champ distinct de la valeur indicative), méthode, fréquence, unité, règle de mesure quantifiée (min/max/plage/cible ± tolérance), support concerné, famille, caractère obligatoire/facultatif, **justifications documentaires** (type CCTP/PAQ/SOPAQ/fiche technique/DTA/ATEx/norme/guide/notice/plan, référence, version, date, page, article, extrait, commentaire).

Règles importantes :
- Les valeurs livrées sont **indicatives** (Fascicule 67-I, Fascicule 65, MEMOAR X-1) et **ne sont jamais présentées comme des exigences universelles** ; le CCTP/PAQ/AT du chantier prime.
- L'application distingue : valeur indicative du référentiel / valeur contractuelle applicable / valeur mesurée / résultat.
- **Historique** de toutes les modifications (menu « 📜 Historique »).
- Chaque PV conserve une **copie figée** du référentiel au moment de sa création : modifier/supprimer un point n'altère jamais les anciens PV.
- « ↺ Restaurer les valeurs livrées » remet le référentiel initial.

## Référentiel spécifique à une opération

Depuis la fiche d'un contrôle dans un dossier, les valeurs peuvent être surchargées **localement** (surcharge propre au dossier) sans toucher au référentiel général.
