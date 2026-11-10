/* Construction d’un modèle de document neutre (blocs) à partir d’un dossier PV.
 * Partagé par les exporteurs PDF (jsPDF), DOCX et ODT.
 * Règles appliquées ici :
 *  - seuls les contrôles effectivement renseignés apparaissent (statut explicite requis) ;
 *  - les photos figurent en fin de chaque phase concernée, légendées et numérotées ;
 *  - la conclusion automatique ne conclut jamais à la conformité globale en présence
 *    de non-conformités ou de contrôles en attente. */
import { controlesApplicables, resultatsParPhase, conclusionAuto, supportLabel, STATUT_LABELS, etatAvancement } from './model.js';
import { fmtDate, fmtDateTime } from './util.js';

export function buildDocModel(pv, ref, settings, agents, { inclureNonRenseignes = false, logoDataUrl = null } = {}) {
  const blocks = [];
  const applic = controlesApplicables(ref.controles, pv);
  const byPhase = resultatsParPhase(pv, ref);
  let photoNum = 0;
  const photosOfPhase = (phaseId) =>
    (pv.photos || [])
      .filter((p) => p.phaseId === phaseId || (p.controlId && applic.find((c) => c.id === p.controlId && c.phaseId === phaseId)))
      .sort((a, b) => a.ordre - b.ordre);
  const photosOfIntervention = (intId) => (pv.photos || []).filter((p) => p.interventionId === intId && !p.controlId && !p.phaseId).sort((a, b) => a.ordre - b.ordre);
  const agentName = (id) => {
    const a = agents.find((x) => x.id === id);
    return a ? `${a.prenom || ''} ${a.nom || ''}`.trim() + (a.societe ? ` (${a.societe})` : '') : '';
  };
  const agentNames = (ids) => (ids || []).map(agentName).filter(Boolean).join(', ');

  /* ---------- page de garde ---------- */
  blocks.push({ t: 'cover', societe: settings.societe, logoDataUrl, numero: pv.numero, titre: 'PROCÈS-VERBAL DE CONTRÔLE', sousTitre: "Mise en œuvre de l’étanchéité — ouvrages d’art", intitule: pv.intitule, ouvrage: pv.ouvrage, localisation: pv.localisation, dateEdition: fmtDateTime(new Date().toISOString()), statut: etatAvancement(pv, ref), demo: !!pv.demo });

  /* ---------- 1. informations générales ---------- */
  blocks.push({ t: 'h1', num: '1', text: 'Informations générales' });
  const kv = [
    ['Numéro du PV', pv.numero],
    ["Intitulé de l’opération", pv.intitule],
    ["Nom de l’ouvrage", pv.ouvrage],
    ['Localisation', pv.localisation],
    ["Maître d’ouvrage", pv.maitreOuvrage],
    ["Maître d'œuvre", pv.maitreOeuvre],
    ['Entreprise titulaire du marché', pv.entreprise],
    ["Entreprise spécialisée en étanchéité", pv.entrepriseEtancheite],
    ['Lot concerné', pv.lot],
    ['Nature des travaux', pv.natureTravaux],
    ["Procédé d’étanchéité (famille)", familleNom(ref, pv.familleId) + (pv.procedeNom ? ` — ${pv.procedeNom}` : '')],
    ['Fabricant', pv.fabricant],
    ['Référence commerciale du système', pv.referenceSysteme],
    ['Support', supportLabel(pv.support)],
    ['Références des documents techniques', pv.refsDocTechniques],
    ['Conditions météorologiques', pv.meteo],
  ].filter(([, v]) => v);
  blocks.push({ t: 'kv', rows: kv });
  if (pv.observations) blocks.push({ t: 'p', label: 'Observations générales', text: pv.observations });

  /* ---------- 2. intervenants ---------- */
  blocks.push({ t: 'h1', num: '2', text: 'Intervenants' });
  const clients = agents.filter((a) => a.role === 'client');
  const controles = agents.filter((a) => a.role === 'controle');
  if (clients.length) {
    blocks.push({ t: 'h2', text: 'Représentants du maître d’ouvrage / client' });
    blocks.push({ t: 'table', head: ['Nom', 'Prénom', 'Fonction', 'Société', 'Coordonnées'], rows: clients.map((a) => [`${a.nom || ''}`, `${a.prenom || ''}`, a.fonction || '', a.societe || '', [a.tel, a.email].filter(Boolean).join(' — ')]) });
  }
  if (controles.length) {
    blocks.push({ t: 'h2', text: 'Chargés de contrôle / suivi / vérification' });
    blocks.push({ t: 'table', head: ['Nom', 'Prénom', 'Fonction', 'Société', 'Coordonnées'], rows: controles.map((a) => [`${a.nom || ''}`, `${a.prenom || ''}`, a.fonction || '', a.societe || '', [a.tel, a.email].filter(Boolean).join(' — ')]) });
  }
  if (!clients.length && !controles.length) blocks.push({ t: 'p', text: 'Aucun agent enregistré (voir espace « Agents & intervenants »).' });

  /* ---------- 3. dates d’intervention ---------- */
  blocks.push({ t: 'h1', num: '3', text: "Dates d’intervention" });
  if (pv.interventions?.length) {
    blocks.push({ t: 'table', head: ['Date', 'Heure', 'Description', 'Agents contrôle', 'Représentants client', 'Observations'],
      rows: pv.interventions.map((iv) => [fmtDate(iv.date), iv.heure || '', iv.description || '', agentNames(iv.agentIds), agentNames(iv.clientIds), iv.observations || '']) });
    for (const iv of pv.interventions) {
      const phs = photosOfIntervention(iv.id);
      for (const p of phs) blocks.push({ t: 'img', photoId: p.id, legend: p.legende, num: ++photoNum });
    }
  } else {
    blocks.push({ t: 'p', text: "Aucune date d’intervention renseignée." });
  }

  /* ---------- 4. référentiel & références contractuelles ---------- */
  blocks.push({ t: 'h1', num: '4', text: 'Référentiel de contrôle utilisé et références contractuelles' });
  blocks.push({ t: 'p', text: `Référentiel figé à la création du dossier (version ${pv.referentielSnapshot?.meta?.version || '1.0'} — ${applic.length} points applicables au support « ${supportLabel(pv.support)} » et à la famille « ${familleNom(ref, pv.familleId)} »).` });
  if (ref.meta?.avertissement) blocks.push({ t: 'warning', text: ref.meta.avertissement });
  const refs = applic.flatMap((c) => (c.refs || []).map((r) => ({ ...r, controlId: c.id, intitule: c.intitule })));
  if (refs.length) {
    blocks.push({ t: 'h2', text: 'Justifications documentaires associées aux critères' });
    blocks.push({ t: 'table', head: ['Contrôle', 'Type de document', 'Référence', 'Version/indice', 'Date', 'Page', 'Article', 'Extrait / résumé'],
      rows: refs.map((r) => [r.controlId + ' — ' + r.intitule, r.typeDoc || '', r.reference || '', r.version || '', r.dateDoc ? fmtDate(r.dateDoc) : '', r.page || '', r.article || '', r.extrait || r.commentaire || '']) });
  }

  /* ---------- 5. synthèse ---------- */
  const renseignes = applic.filter((c) => pv.resultats?.[c.id]?.statut);
  const counts = { conforme: 0, non_conforme: 0, conforme_reserves: 0, non_applicable: 0, en_attente: 0 };
  for (const c of renseignes) counts[pv.resultats[c.id].statut]++;
  blocks.push({ t: 'h1', num: '5', text: 'Synthèse des contrôles' });
  const synthRows = [];
  for (const { phase, items, renseignes: n } of byPhase) {
    if (!n) continue;
    const pc = { conforme: 0, non_conforme: 0, conforme_reserves: 0, non_applicable: 0, en_attente: 0 };
    for (const it of items) { const s = it.res?.statut; if (s) pc[s]++; }
    synthRows.push([phase.titre, String(n), String(pc.conforme), String(pc.non_conforme), String(pc.conforme_reserves), String(pc.en_attente), String(pc.non_applicable)]);
  }
  blocks.push({ t: 'table', head: ['Phase', 'Renseignés', 'Conformes', 'Non conformes', 'Sous réserves', 'En attente', 'N/A'], rows: synthRows.length ? synthRows : [['—', '0', '0', '0', '0', '0', '0']] });
  blocks.push({ t: 'p', text: `Total : ${renseignes.length} / ${applic.length} points de contrôle renseignés — ${counts.conforme} conforme(s), ${counts.non_conforme} non conforme(s), ${counts.conforme_reserves} sous réserves, ${counts.en_attente} en attente, ${counts.non_applicable} non applicable(s).` });

  /* ---------- 6..N chapitres par phase ---------- */
  let section = 5;
  for (const { phase, items } of byPhase) {
    const renseigneItems = items.filter((i) => i.res && i.res.statut);
    const aAfficher = inclureNonRenseignes ? items : renseigneItems;
    if (!aAfficher.length) continue;
    section++;
    blocks.push({ t: 'h1', num: String(section), text: phase.titre });
    for (const { ctrl, res } of aAfficher) {
      blocks.push(ctrlBlock(ctrl, res, pv, agentNames));
    }
    const phs = photosOfPhase(phase.id);
    if (phs.length) {
      blocks.push({ t: 'h3', text: 'Photographies associées' });
      for (const p of phs) blocks.push({ t: 'img', photoId: p.id, legend: p.legende, num: ++photoNum });
    }
  }

  /* ---------- conclusion ---------- */
  section++;
  blocks.push({ t: 'h1', num: String(section), text: 'Conclusion' });
  const auto = conclusionAuto(pv, ref);
  blocks.push({ t: 'conclusion', avis: auto.avis, texte: pv.conclusion || auto.texte });
  if (pv.synthese) blocks.push({ t: 'p', label: 'Synthèse complémentaire (saisie manuelle)', text: pv.synthese });

  /* ---------- validation & signatures ---------- */
  section++;
  blocks.push({ t: 'h1', num: String(section), text: 'Validation et signatures' });
  blocks.push({ t: 'p', text: `Édité le ${fmtDateTime(new Date().toISOString())} — PV n° ${pv.numero}. Document généré localement sur l’appareil de contrôle ; données stockées localement.` });
  blocks.push({ t: 'sig', titre: 'Le représentant du maître d ouvrage / client', noms: pv.interventions?.length ? agentNames([...new Set(pv.interventions.flatMap((i) => i.clientIds || []))]) : '' });
  blocks.push({ t: 'sig', titre: 'Le chargé de contrôle', noms: pv.interventions?.length ? agentNames([...new Set(pv.interventions.flatMap((i) => i.agentIds || []))]) : '' });

  return {
    numero: pv.numero,
    headerText: `${settings.societe ? settings.societe + ' — ' : ''}${pv.intitule || 'Procès-verbal'}`,
    footerText: settings.piedPage || '',
    primaryColor: settings.couleurPrimaire || '#0d47a1',
    blocks,
  };
}

function familleNom(ref, id) {
  const f = (ref.familles || []).find((x) => x.id === id);
  return f ? `${f.code} — ${f.nom}` : (id || '');
}

function ctrlBlock(ctrl, res, pv, agentNames) {
  const rows = [
    ['Critère d acceptation (valeur indicative du référentiel)', ctrl.exigence || '—'],
    ['Valeur contractuelle applicable', ctrl.valeurContractuelle || 'À confirmer selon CCTP / AT du procédé (valeur indicative ci-dessus)'],
    ['Méthode / moyen de contrôle', ctrl.methode || '—'],
    ['Fréquence / échantillonnage', ctrl.frequence || '—'],
    ['Référence documentaire', ctrl.source || '—'],
  ];
  if (ctrl.mesure && ctrl.mesure.type && ctrl.mesure.type !== 'aucune') {
    const m = ctrl.mesure;
    const plage = m.type === 'plage' ? `${m.min ?? '…'} à ${m.max ?? '…'}` : m.type === 'min' ? `≥ ${m.min}` : m.type === 'max' ? `≤ ${m.max}` : m.type === 'cible' ? `${m.cible} ± ${m.tolerance || 0}` : '';
    rows.push(['Valeur / plage admissible (quantifiée)', `${plage} ${m.unite || ''}`.trim()]);
  }
  if (res) {
    rows.push(['Résultat constaté', res.mesure !== undefined && res.mesure !== null && res.mesure !== '' ? `${res.mesure} ${res.unite || ctrl.mesure?.unite || ''}`.trim() : '—']);
    rows.push(['Statut', { chip: res.statut, label: STATUT_LABELS[res.statut] || res.statut }]);
    if (res.commentaire) rows.push(['Commentaire', res.commentaire]);
    rows.push(['Agent(s) responsable(s)', agentNames(res.agentIds)]);
    if (res.interventionId) {
      const iv = pv.interventions?.find((i) => i.id === res.interventionId);
      rows.push(["Date d’intervention", iv ? fmtDate(iv.date) + (iv.heure ? ' ' + iv.heure : '') : '—']);
    }
  } else {
    rows.push(['Statut', 'Non renseigné (masqué du document final)']);
  }
  return {
    t: 'ctrl',
    code: ctrl.code,
    titre: ctrl.intitule,
    badges: [
      ...(ctrl.pointArret ? [{ tag: 'PA', label: 'Point d arrêt' }] : []),
      ...(ctrl.pointCritique ? [{ tag: 'PC', label: 'Point critique' }] : []),
      ...(ctrl.obligatoire ? [{ tag: 'OBL', label: 'Obligatoire' }] : [{ tag: 'FAC', label: 'Facultatif' }]),
    ],
    rows,
  };
}
