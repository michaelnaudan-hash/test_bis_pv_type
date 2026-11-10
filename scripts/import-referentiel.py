#!/usr/bin/env python3
"""Importe le référentiel de contrôles (Excel) vers data/referentiel.json.

Usage : python3 scripts/import-referentiel.py [chemin.xlsx] [sortie.json]
Par défaut, lit le fichier Excel déposé à la racine du projet (s'il est présent)
ou le chemin passé en argument, et écrit data/referentiel.json.
"""
import json
import os
import sys

import openpyxl

FAMILLE_MAP = {
    "—": "toutes",
    "-": "toutes",
    "Feuilles FPM/FPA": "FPM",
    "Asphalte bicouche/monocouche": "ASP",
    "SEL (étanchéité liquide)": "SEL",
    "SESM (complexe épais acier)": "SESM",
    "MHC (membrane + micro-béton)": "MHC",
}

SUPPORT_MAP = {"Commun": "commun", "Béton": "beton", "Acier": "acier"}

FAMILLES = [
    {
        "id": "FPM",
        "code": "FPM/FPA",
        "nom": "Feuilles bitumineuses préfabriquées (FPM/FPA)",
        "description": "Feuilles adhérentes ou semi-indépendantes ; cahier de pose du fabricant sous avis technique Cerema/Sétra.",
        "supports": {"beton": True, "acier": "selon AT"},
    },
    {
        "id": "ASP",
        "code": "ASP",
        "nom": "Asphalte coulé bicouche / monocouche",
        "description": "Prélèvements 2 × 3 échantillons par porteur ; bulletin d'indentation usine.",
        "supports": {"beton": True, "acier": "selon AT"},
    },
    {
        "id": "SEL",
        "code": "SEL",
        "nom": "Systèmes d'étanchéité liquide (SEL)",
        "description": "Porosité goutte d'eau 60–240 s ; dureté Shore A ≥ 70 avant circulation.",
        "supports": {"beton": True, "acier": "selon AT"},
    },
    {
        "id": "SESM",
        "code": "SESM",
        "nom": "Complexe épais sur tablier acier (SESM)",
        "description": "Grenaillage Sa 2½ suivi au plus près de l'accrochage ; tableau 22 du fascicule 67-I.",
        "supports": {"beton": "selon AT", "acier": True},
    },
    {
        "id": "MHC",
        "code": "MHC",
        "nom": "Membrane + couche hydrocarbonée (MHC)",
        "description": "Micro-béton bitumineux + protection granulaire ; tableau 22 du fascicule 67-I pour le vent.",
        "supports": {"beton": True, "acier": "selon AT"},
    },
]


def clean(v):
    if v is None:
        return ""
    return str(v).replace("\n", " ").strip()


def main():
    default_xlsx = os.path.join(os.path.dirname(__file__), "..", "referentiel-etancheite.xlsx")
    xlsx = sys.argv[1] if len(sys.argv) > 1 else default_xlsx
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(__file__), "..", "data", "referentiel.json"
    )
    wb = openpyxl.load_workbook(xlsx, data_only=True)

    ws_choix = wb["Choix & familles"]
    base_doc = ""
    avertissement = ""
    rows_choix = [[clean(c) for c in r] for r in ws_choix.iter_rows(values_only=True)]
    for i, vals in enumerate(rows_choix):
        if vals[1] == "Base documentaire" and i + 1 < len(rows_choix):
            base_doc = next((v for v in rows_choix[i + 1] if v), "")
    ws = wb["Référentiel"]
    rows_ref = [[clean(c) for c in r] for r in ws.iter_rows(values_only=True)]
    for i, vals in enumerate(rows_ref):
        if vals[1] == "Avertissement" and i + 1 < len(rows_ref):
            avertissement = next((v for v in rows_ref[i + 1] if v), "")

    phases = []
    phase_ids = {}
    controles = []
    for row in rows_ref:
        vals = row
        code = clean(row[2])
        if not code.startswith("CTL-"):
            continue
        etape = clean(row[1])
        if etape not in phase_ids:
            pid = "PH-" + str(len(phases) + 1).zfill(2)
            phase_ids[etape] = pid
            phases.append({"id": pid, "ordre": len(phases) + 1, "titre": etape})
        typ = clean(row[4])
        controles.append(
            {
                "id": code,
                "code": code,
                "phaseId": phase_ids[etape],
                "intitule": clean(row[3]),
                "type": typ,
                "pointArret": "PA" in typ,
                "pointCritique": "PC" in typ,
                "support": SUPPORT_MAP.get(clean(row[5]), "commun"),
                "famille": FAMILLE_MAP.get(clean(row[6]), "toutes"),
                "exigence": clean(row[7]),
                "methode": clean(row[8]),
                "frequence": clean(row[9]),
                "acteurs": clean(row[10]),
                "source": clean(row[11]),
                "obligatoire": True,
                "mesure": None,
                "refs": [],
                "observationsRef": "",
                "actif": True,
                "ordre": len(controles) + 1,
            }
        )

    data = {
        "meta": {
            "version": "1.0",
            "titre": "Référentiel des contrôles — Étanchéité des ponts-routes et passerelles",
            "baseDocumentaire": base_doc,
            "avertissement": avertissement,
            "sourceFichier": os.path.basename(xlsx),
        },
        "familles": FAMILLES,
        "phases": phases,
        "controles": controles,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"OK: {len(controles)} points de contrôle, {len(phases)} phases -> {out}")


if __name__ == "__main__":
    main()
