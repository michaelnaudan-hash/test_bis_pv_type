/* Administration du référentiel : CRUD procédés/phases/points, valeurs admissibles,
 * justifications documentaires, historique des modifications, restauration des valeurs livrées.
 * Les dossiers existants conservent une copie figée (snapshot) — la suppression d’un point
 * ne modifie pas les anciens PV. */
import * as store from '../store.js';
import { h, toast, confirmDialog, field, textInput, textarea, select, numInput } from '../ui.js';
import { TYPES_DOC, SUPPORTS } from '../model.js';
import { fmtDateTime, uid } from '../util.js';

export async function render(ctx) {
  const ref = await store.getReferentiel();
  const history = await store.getRefHistory();
  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 8px' }, 'Référentiel des contrôles'));

  ctx.view.append(h('div', { class: 'alert info' },
    h('b', {}, 'Base documentaire : '), ref.meta.baseDocumentaire || '—', ' ',
    h('br'), h('b', {}, 'Avertissement : '), ref.meta.avertissement || 'Les valeurs du référentiel sont indicatives ; les valeurs contractuelles (CCTP, PAQ, avis technique du procédé) priment.'));

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn primary', onclick: () => editControl(null) }, '+ Ajouter un point de contrôle'),
    h('button', { class: 'btn', onclick: addPhase }, '+ Ajouter une phase'),
    h('button', { class: 'btn danger', onclick: async () => {
      if (await confirmDialog({ title: 'Restaurer le référentiel initial ?', body: 'Toutes les modifications administrateur seront supprimées et le référentiel livré avec l application sera rétabli. Les anciens PV conservent leur copie figée.', danger: true, confirmLabel: 'Restaurer' })) {
        await store.restoreReferentielDefaults();
        toast('Référentiel restauré aux valeurs initiales.', 'ok');
        render(ctx);
      }
    } }, '↺ Restaurer les valeurs livrées'),
    h('button', { class: 'btn', onclick: () => showHistory() }, '📜 Historique des modifications'));
  ctx.view.append(toolbar);

  const filterBar = h('div', { class: 'toolbar' },
    h('label', { class: 'switch' }, h('span', { style: 'font-weight:600' }, 'Support :'), (() => { const s = select([{ value: '', label: 'Tous' }, ...SUPPORTS.map((x) => ({ value: x.id, label: x.label }))], ''); s.addEventListener('change', () => drawList(s.value)); return s; })()),
    h('label', { class: 'switch' }, h('span', { style: 'font-weight:600' }, 'Famille :'), (() => { const s = select([{ value: '', label: 'Toutes' }, ...ref.familles.map((f) => ({ value: f.id, label: f.code }))], ''); s.addEventListener('change', () => drawList(document.querySelector('#ref-sup')?.value || '', s.value)); return s; })()));
  ctx.view.append(filterBar);

  const listEl = h('div', {});
  ctx.view.append(listEl);

  function drawList(support = '', famille = '') {
    listEl.innerHTML = '';
    for (const ph of ref.phases) {
      let items = ref.controles.filter((c) => c.phaseId === ph.id);
      if (support) items = items.filter((c) => c.support === 'commun' || c.support === support);
      if (famille) items = items.filter((c) => c.famille === 'toutes' || c.famille === famille);
      if (!items.length) continue;
      const block = h('div', { class: 'phase-block' },
        h('div', { class: 'phase-head' },
          ph.titre,
          h('span', { class: 'count' }, `${items.length} point(s)`),
          h('button', { class: 'btn small', style: 'margin-left:8px', onclick: () => editPhase(ph) }, 'Modifier la phase'),
          h('button', { class: 'btn small danger', style: 'margin-left:4px', onclick: () => delPhase(ph) }, 'Supprimer')));
      listEl.append(block);
      for (const c of items) {
        block.append(h('div', { class: 'ctrl' },
          h('div', { class: 'ctrl-head' },
            h('span', { class: 'code' }, c.code),
            h('span', { class: 'titre' }, c.intitule),
            h('span', { html: `${c.pointArret ? '<span class="tag pa">PA</span>' : ''}${c.pointCritique ? '<span class="tag pc">PC</span>' : ''} <span class="tag">${c.support === 'commun' ? 'Commun' : c.support === 'beton' ? 'Béton' : 'Acier'}</span> <span class="tag">${c.famille === 'toutes' ? 'Toutes familles' : c.famille}</span>` })),
          h('div', { class: 'exigence' }, c.exigence || '—'),
          h('div', { class: 'meta-line' }, `Méthode : ${c.methode || '—'} · Fréquence : ${c.frequence || '—'} · Source : ${c.source || '—'}${c.mesure ? ' · Quantifié : ' + JSON.stringify(c.mesure) : ''}${c.refs?.length ? ' · ' + c.refs.length + ' réf. doc.' : ''}`),
          h('div', { class: 'row', style: 'margin-top:8px' },
            h('button', { class: 'btn small', onclick: () => editControl(c) }, 'Modifier'),
            h('button', { class: 'btn small', onclick: () => dupControl(c) }, 'Dupliquer'),
            h('button', { class: 'btn small danger', onclick: () => delControl(c) }, 'Supprimer'))));
      }
    }
  }

  async function addPhase() {
    const backdrop = h('div', { class: 'modal-backdrop' });
    const t = textInput('');
    const btnOk = h('button', { class: 'btn primary' }, 'Ajouter');
    btnOk.addEventListener('click', async () => {
      if (!t.value.trim()) { toast('Titre obligatoire.', 'err'); return; }
      const newPh = { id: 'PH-U' + uid().slice(0, 6), ordre: 100 + ref.phases.length, titre: t.value.trim() };
      await store.saveControl({ id: 'PHASE:' + newPh.id, phaseId: newPh.id, intitule: newPh.titre, actif: true, type: '', code: 'PHASE', customPhase: newPh }, 'ajout_phase');
      toast('Phase ajoutée (utilisable pour de nouveaux points).', 'ok');
      backdrop.remove();
      render(ctx);
    });
    const modal = h('div', { class: 'modal' },
      h('h3', {}, 'Nouvelle phase de contrôle'),
      field('Titre de la phase', t),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
        btnOk));
    backdrop.append(modal);
    document.getElementById('modal-root').append(backdrop);
  }

  async function editPhase(ph) {
    const backdrop = h('div', { class: 'modal-backdrop' });
    const t = textInput(ph.titre);
    const modal = h('div', { class: 'modal' },
      h('h3', {}, 'Modifier la phase'),
      field('Titre', t),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          await store.saveControl({ id: 'PHASE:' + ph.id, customPhase: { ...ph, titre: t.value.trim() }, actif: true }, 'modification_phase');
          toast('Phase modifiée.', 'ok'); backdrop.remove(); render(ctx);
        } }, 'Enregistrer')));
    backdrop.append(modal);
    document.getElementById('modal-root').append(backdrop);
  }

  async function delPhase(ph) {
    if (!await confirmDialog({ title: 'Supprimer la phase ?', body: `La phase « ${ph.titre} » sera retirée du référentiel (les anciens PV conservent leur copie figée). Les points de cette phase restent dans le référentiel.` , danger: true, confirmLabel: 'Supprimer' })) return;
    await store.saveControl({ id: 'PHASE:' + ph.id, deleted: true }, 'suppression_phase');
    toast('Phase supprimée du référentiel.', 'ok');
    render(ctx);
  }

  async function dupControl(c) {
    const copy = { ...c, id: c.id + '-COPIE-' + uid().slice(0, 4), code: c.code + '-C', intitule: c.intitule + ' (copie)', ordre: (c.ordre || 0) + 0.5 };
    await store.saveControl(copy, 'ajout');
    toast('Point dupliqué : ' + copy.code, 'ok');
    render(ctx);
  }

  async function delControl(c) {
    if (!await confirmDialog({ title: 'Supprimer ce point de contrôle ?', body: `« ${c.intitule} » (${c.code}) sera retiré du référentiel général. Les PV existants conservent la copie figée du critère au moment de leur création.`, danger: true, confirmLabel: 'Supprimer du référentiel' })) return;
    await store.deleteControl(c.id);
    toast('Point supprimé du référentiel (historique conservé).', 'ok');
    render(ctx);
  }

  function editControl(c) {
    const isNew = !c;
    const d = c ? { ...c, refs: c.refs || [], mesure: c.mesure || { type: 'aucune' } } : {
      id: 'CTL-U-' + uid().slice(0, 8).toUpperCase(), code: '', phaseId: ref.phases[0]?.id, intitule: '', type: 'PC',
      support: 'commun', famille: 'toutes', exigence: '', methode: '', frequence: '', acteurs: '', source: '',
      obligatoire: true, mesure: { type: 'aucune' }, refs: [], observationsRef: '', actif: true, ordre: 999,
    };
    const backdrop = h('div', { class: 'modal-backdrop' });
    const els = {
      code: textInput(d.code), intitule: textInput(d.intitule),
      phase: select(ref.phases.map((p) => ({ value: p.id, label: p.titre })), d.phaseId),
      type: select([{ value: 'PC', label: 'PC — point critique' }, { value: 'PA', label: 'PA — point d arrêt' }, { value: 'PC / PA', label: 'PC / PA' }], d.type),
      support: select([{ value: 'commun', label: 'Commun (béton + acier)' }, ...SUPPORTS.map((s) => ({ value: s.id, label: s.label }))], d.support),
      famille: select([{ value: 'toutes', label: 'Toutes familles' }, ...ref.familles.map((f) => ({ value: f.id, label: f.code }))], d.famille),
      exigence: textarea(d.exigence, { rows: 3 }),
      valeurContractuelle: textInput(d.valeurContractuelle || ''),
      methode: textInput(d.methode), frequence: textInput(d.frequence), source: textInput(d.source),
      obligatoire: select([{ value: '1', label: 'Obligatoire' }, { value: '0', label: 'Facultatif' }], d.obligatoire ? '1' : '0'),
      mesureType: select([
        { value: 'aucune', label: 'Qualitatif (pas de mesure auto)' }, { value: 'min', label: 'Valeur minimale' },
        { value: 'max', label: 'Valeur maximale' }, { value: 'plage', label: 'Plage [min–max]' }, { value: 'cible', label: 'Valeur cible ± tolérance' },
      ], d.mesure?.type || 'aucune'),
      mMin: numInput(d.mesure?.min ?? ''), mMax: numInput(d.mesure?.max ?? ''), mCible: numInput(d.mesure?.cible ?? ''), mTol: numInput(d.mesure?.tolerance ?? ''), mUnite: textInput(d.mesure?.unite || ''),
      observationsRef: textarea(d.observationsRef || '', { rows: 2 }),
    };
    // références documentaires
    const refsBox = h('div', {});
    const renderRefs = () => {
      refsBox.innerHTML = '';
      d.refs.forEach((r, i) => {
        refsBox.append(h('div', { class: 'card', style: 'padding:8px;margin-bottom:6px' },
          h('div', { class: 'grid2' },
            field('Type de document', select(TYPES_DOC.map((t) => ({ value: t, label: t })), r.typeDoc || '')),
            field('Référence', textInput(r.reference || '')),
            field('Version / indice', textInput(r.version || '')),
            field('Date du document', h('input', { type: 'date', value: r.dateDoc || '' })),
            field('Page', textInput(r.page || '')),
            field('Article / paragraphe', textInput(r.article || ''))),
          field('Extrait / résumé de l exigence', textarea(r.extrait || '', { rows: 2 })),
          field('Commentaire de justification', textarea(r.commentaire || '', { rows: 2 })),
          h('button', { class: 'btn small danger', onclick: () => { d.refs.splice(i, 1); renderRefs(); } }, 'Retirer cette référence')));
      });
    };
    renderRefs();

    const modal = h('div', { class: 'modal', style: 'max-width:760px' },
      h('h3', {}, isNew ? 'Nouveau point de contrôle' : `Modifier ${d.code}`),
      h('div', { class: 'grid2' },
        field('Code / identifiant unique *', els.code, { required: true }),
        field('Intitulé *', els.intitule, { required: true }),
        field('Phase', els.phase),
        field('Type', els.type),
        field('Support concerné', els.support),
        field('Famille de procédé', els.famille),
        field('Obligatoire / facultatif', els.obligatoire)),
      field('Description / opération à vérifier + critère d acceptation (valeur indicative du référentiel) *', els.exigence, { required: true, hint: 'Ne jamais présenter ces valeurs comme des exigences réglementaires universelles.' }),
      field('Valeur contractuelle applicable (à confirmer chantier)', els.valeurContractuelle),
      h('div', { class: 'grid2' },
        field('Méthode / moyen de contrôle', els.methode),
        field('Fréquence / échantillonnage', els.frequence),
        field('Acteurs', els.source)),
      h('h3', {}, 'Mesure quantifiée (conformité automatique)'),
      h('div', { class: 'grid2' },
        field('Type de règle', els.mesureType),
        field('Unité', els.mUnite),
        field('Min', els.mMin), field('Max', els.mMax),
        field('Cible', els.mCible), field('Tolérance', els.mTol)),
      h('p', { class: 'hint' }, 'Sans règle quantifiée, la conformité n est jamais déduite automatiquement.'),
      h('h3', {}, 'Justifications documentaires (références contractuelles)'),
      refsBox,
      h('button', { class: 'btn small', onclick: () => { d.refs.push({ typeDoc: '', reference: '', version: '', dateDoc: '', page: '', article: '', extrait: '', commentaire: '' }); renderRefs(); } }, '+ Ajouter une référence documentaire'),
      field('Observations complémentaires', els.observationsRef),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!els.code.value.trim() || !els.intitule.value.trim() || !els.exigence.value.trim()) { toast('Code, intitulé et critère obligatoires.', 'err'); return; }
          const rec = {
            ...d,
            code: els.code.value.trim(), intitule: els.intitule.value.trim(),
            phaseId: els.phase.value, type: els.type.value, support: els.support.value, famille: els.famille.value,
            exigence: els.exigence.value.trim(), valeurContractuelle: els.valeurContractuelle.value.trim(),
            methode: els.methode.value.trim(), frequence: els.frequence.value.trim(), source: els.source.value.trim(),
            pointArret: els.type.value.includes('PA'), pointCritique: els.type.value.includes('PC'),
            obligatoire: els.obligatoire.value === '1',
            mesure: { type: els.mesureType.value, min: els.mMin.value === '' ? null : Number(els.mMin.value), max: els.mMax.value === '' ? null : Number(els.mMax.value), cible: els.mCible.value === '' ? null : Number(els.mCible.value), tolerance: els.mTol.value === '' ? null : Number(els.mTol.value), unite: els.mUnite.value.trim() },
            refs: d.refs, observationsRef: els.observationsRef.value.trim(), actif: true,
          };
          await store.saveControl(rec, isNew ? 'ajout' : 'modification');
          toast('Point de contrôle enregistré (historique mis à jour).', 'ok');
          backdrop.remove();
          render(ctx);
        } }, 'Enregistrer')));
    backdrop.append(modal);
    document.getElementById('modal-root').append(backdrop);
  }

  function showHistory() {
    const backdrop = h('div', { class: 'modal-backdrop' });
    const rows = history.slice(0, 100).map((x) => `<tr><td>${fmtDateTime(x.date)}</td><td>${x.action}</td><td class="mono">${x.controlId || ''}</td><td style="font-size:0.8rem">${x.detail ? JSON.stringify(x.detail).slice(0, 200) : ''}</td></tr>`).join('');
    const modal = h('div', { class: 'modal', style: 'max-width:720px' },
      h('h3', {}, 'Historique des modifications du référentiel'),
      h('div', { style: 'max-height:60vh;overflow:auto' },
        h('table', { class: 'data' }, h('thead', {}, h('tr', {}, '<th>Date</th><th>Action</th><th>Élément</th><th>Détail</th>')), h('tbody', { html: rows || '<tr><td colspan="4">Aucune modification.</td></tr>' }))),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Fermer')));
    backdrop.append(modal);
    document.getElementById('modal-root').append(backdrop);
  }

  drawList();
}
