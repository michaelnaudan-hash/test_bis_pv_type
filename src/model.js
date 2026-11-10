/* Logique métier pure : statuts, filtrage du référentiel, conformité, conclusion, cohérence. */
import { deepClone } from './util.js';

export const STATUTS = ['conforme', 'non_conforme', 'conforme_reserves', 'non_applicable', 'en_attente'];

export const STATUT_LABELS = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  conforme_reserves: 'Conforme sous réserves',
  non_applicable: 'Non applicable',
  en_attente: 'En attente de contrôle',
};

export const ETATS_PV = ['preparation', 'en_cours', 'a_completer', 'finalise', 'edite'];
export const ETAT_LABELS = {
  preparation: 'En préparation',
  en_cours: 'En cours de contrôle',
  a_completer: 'À compléter',
  finalise: 'Finalisé',
  edite: 'Édité',
  archive: 'Archivé',
};

export const SUPPORTS = [
  { id: 'beton', label: 'Béton' },
  { id: 'acier', label: 'Acier' },
];

export const TYPES_DOC = [
  'CCTP', 'PAQ', 'SOPAQ', 'Fiche technique', 'DTA', 'ATEx',
  'Norme NF EN', 'Guide technique', 'Notice fabricant', "Plan d’exécution", 'Autre',
];

/* Filtre les points de contrôle applicables à un PV (support + famille de procédé). */
export function controlesApplicables(controles, { support, familleId } = {}) {
  return (controles || []).filter((c) => {
    if (c.actif === false) return false;
    const okSupport = !c.support || c.support === 'commun' || c.support === support;
    const okFamille = !c.famille || c.famille === 'toutes' || c.famille === familleId;
    return okSupport && okFamille;
  });
}

/* Évaluation automatique de la conformité quand le critère est quantifié.
 * Retourne null si on ne peut pas conclure (informations absentes ou ambiguës). */
export function evaluerConformite(ctrl, mesure) {
  const m = ctrl && ctrl.mesure;
  if (!m || m.type === 'aucune' || mesure === null || mesure === undefined || mesure === '' || isNaN(Number(mesure))) return null;
  const v = Number(mesure);
  const tol = Number(m.tolerance) || 0;
  switch (m.type) {
    case 'min': return v >= Number(m.min) - tol ? 'conforme' : 'non_conforme';
    case 'max': return v <= Number(m.max) + tol ? 'conforme' : 'non_conforme';
    case 'plage': {
      const min = m.min !== null && m.min !== undefined && m.min !== '' ? Number(m.min) : -Infinity;
      const max = m.max !== null && m.max !== undefined && m.max !== '' ? Number(m.max) : Infinity;
      return v >= min - tol && v <= max + tol ? 'conforme' : 'non_conforme';
    }
    case 'cible': {
      const c = Number(m.cible);
      if (isNaN(c)) return null;
      return Math.abs(v - c) <= tol ? 'conforme' : 'non_conforme';
    }
    default: return null;
  }
}

/* Un résultat est "renseigné" s’il a un statut explicite (y compris Non applicable). */
export function estRenseigne(res) {
  return !!res && !!res.statut;
}

/* Résultats d’un PV groupés par phase, uniquement ceux du périmètre (support/famille). */
export function resultatsParPhase(pv, ref) {
  const applic = controlesApplicables(ref.controles, pv);
  const byId = new Map(applic.map((c) => [c.id, c]));
  const out = [];
  for (const ph of ref.phases) {
    const ctrls = applic.filter((c) => c.phaseId === ph.id);
    if (!ctrls.length) continue;
    const items = ctrls.map((c) => ({ ctrl: c, res: pv.resultats?.[c.id] || null }));
    out.push({ phase: ph, items, renseignes: items.filter((i) => estRenseigne(i.res)).length });
  }
  return out;
}

/* État d’avancement calculé d’un PV. */
export function etatAvancement(pv, ref) {
  if (pv.statut === 'edite') return 'edite';
  if (pv.archive) return 'archive';
  const applic = controlesApplicables(ref.controles, pv);
  const renseignes = applic.filter((c) => estRenseigne(pv.resultats?.[c.id])).length;
  if (!pv.support || !pv.familleId) return 'preparation';
  if (renseignes === 0) return 'preparation';
  if (renseignes < applic.length) {
    const anyAttente = applic.some((c) => pv.resultats?.[c.id]?.statut === 'en_attente');
    return anyAttente ? 'a_completer' : 'en_cours';
  }
  return pv.conclusion ? 'finalise' : 'a_completer';
}

/* Conclusion automatique — ne déclare JAMAIS l’ouvrage globalement conforme
 * si des contrôles sont non conformes ou en attente. */
export function conclusionAuto(pv, ref) {
  const applic = controlesApplicables(ref.controles, pv);
  const counts = { conforme: 0, non_conforme: 0, conforme_reserves: 0, non_applicable: 0, en_attente: 0, non_renseignes: 0 };
  for (const c of applic) {
    const s = pv.resultats?.[c.id]?.statut;
    if (!s) counts.non_renseignes++;
    else counts[s] = (counts[s] || 0) + 1;
  }
  const total = applic.length;
  const renseignes = total - counts.non_renseignes;
  let avis;
  if (counts.non_conforme > 0) avis = 'défavorable';
  else if (counts.en_attente > 0 || counts.non_renseignes > 0) avis = 'en_attente';
  else avis = 'favorable';
  const lignes = [
    `Sur ${total} points de contrôle applicables au support « ${supportLabel(pv.support)} » et au procédé retenu, ${renseignes} ont été renseignés.`,
    `Résultats : ${counts.conforme} conforme(s), ${counts.non_conforme} non conforme(s), ${counts.conforme_reserves} conforme(s) sous réserves, ${counts.non_applicable} non applicable(s), ${counts.en_attente} en attente de contrôle, ${counts.non_renseignes} non renseigné(s).`,
  ];
  if (avis === 'défavorable') {
    lignes.push("AVIS : DÉFAVORABLE — des points de contrôle sont NON CONFORMES. L’ouvrage ne peut pas être déclaré conforme en l’état ; les non-conformités doivent être levées (reprises, dérogations) avant toute réception.");
  } else if (avis === 'en_attente') {
    lignes.push("AVIS : EN ATTENTE — des contrôles sont en attente ou non renseignés. Aucune conclusion de conformité globale ne peut être émise tant que ces points ne sont pas levés.");
  } else {
    const reserves = counts.conforme_reserves > 0
      ? ` sous réserve de la levée des ${counts.conforme_reserves} réserve(s) identifiée(s)`
      : '';
    lignes.push(`AVIS : FAVORABLE${reserves} — l’ensemble des points de contrôle renseignés est conforme ou non applicable.`);
  }
  return { avis, counts, texte: lignes.join('\n') };
}

export function supportLabel(s) {
  return s === 'beton' ? 'Béton' : s === 'acier' ? 'Acier' : '';
}

/* Contrôle de cohérence d’un dossier (alertes affichées à l’utilisateur). */
export function coherencePV(pv, ref) {
  const pb = [];
  if (!pv.numero) pb.push('Numéro de PV manquant.');
  if (!pv.intitule) pb.push("Intitulé de l’opération manquant.");
  if (!pv.ouvrage) pb.push("Nom de l’ouvrage manquant.");
  if (!pv.support) pb.push('Support non renseigné (béton / acier).');
  if (!pv.familleId) pb.push("Famille de procédé non renseignée.");
  const applic = new Set(controlesApplicables(ref.controles, pv).map((c) => c.id));
  for (const cid of Object.keys(pv.resultats || {})) {
    if (!applic.has(cid)) pb.push(`Le contrôle ${cid} a des résultats mais n’est plus dans le périmètre (support/procédé) : il est conservé mais exclu du PV.`);
    else if (!pv.resultats[cid].statut) pb.push(`Le contrôle ${cid} a un résultat sans statut.`);
  }
  for (const ph of pv.photos || []) {
    if (!ph.controlId && !ph.phaseId && !ph.interventionId) pb.push(`La photographie n°${ph.ordre} n’est rattachée à aucune partie du PV.`);
  }
  if (!pv.interventions?.length) pb.push('Aucune date d intervention renseignée.');
  return pb;
}

export function cloneSnapshot(ref) {
  return deepClone({ meta: ref.meta, familles: ref.familles, phases: ref.phases, controles: ref.controles });
}
