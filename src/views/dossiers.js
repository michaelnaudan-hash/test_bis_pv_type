/* Gestion des dossiers / PV : liste, recherche, création, duplication, archivage,
 * suppression, exports documentaires (PDF/DOCX/ODT) et sauvegarde archive. */
import * as store from '../store.js';
import { h, toast, confirmDialog, field, textInput, select } from '../ui.js';
import { getReferentiel } from '../store.js';
import { controlesApplicables, etatAvancement, ETAT_LABELS, SUPPORTS } from '../model.js';
import { fmtDateTime, slug, downloadBlob } from '../util.js';
import { buildDocModel } from '../docmodel.js';

export async function render(ctx) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const pvs = await store.listPVs();
  const ref = await getReferentiel();
  const settings = await store.getSettings();
  const agents = await store.listAgents();

  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, 'Dossiers / Procès-verbaux'));

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn primary', onclick: () => showCreate(ctx) }, '+ Nouveau PV'),
    h('input', { type: 'text', class: 'search-input', placeholder: 'Rechercher (n°, opération, ouvrage, date)…', oninput: (e) => filterList(e.target.value) }),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', id: 'flt-archive' }), 'Afficher les archivés'));
  ctx.view.append(toolbar);

  const listEl = h('div', { id: 'pv-list' });
  ctx.view.append(listEl);

  function renderList(q = '', showArch = false) {
    listEl.innerHTML = '';
    let items = pvs;
    if (!showArch) items = items.filter((p) => !p.archive);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      items = items.filter((p) => [p.numero, p.intitule, p.ouvrage, p.localisation, p.entreprise, ...(p.interventions || []).map((i) => i.date)].join(' ').toLowerCase().includes(needle));
    }
    if (!items.length) { listEl.append(h('div', { class: 'card empty' }, 'Aucun dossier.')); return; }
    for (const p of items) listEl.append(row(p));
  }

  function filterList(q) { renderList(q, document.getElementById('flt-archive')?.checked); }
  document.getElementById('flt-archive')?.addEventListener('change', (e) => {
    const q = ctx.view.querySelector('.search-input')?.value || '';
    renderList(q, e.target.checked);
  });

  function row(p) {
    const etat = etatAvancement(p, ref);
    const applic = controlesApplicables(ref.controles, p);
    const done = applic.filter((c) => p.resultats?.[c.id]?.statut).length;
    return h('div', { class: 'card pv-item' },
      h('div', { class: 'main' },
        h('div', {}, h('span', { class: 'num' }, p.numero), ' ', p.demo ? h('span', { class: 'chip demo' }, 'DÉMO') : null, ' ', h('span', { class: `chip ${etat}` }, ETAT_LABELS[etat] || etat), p.archive ? ' ' : null, p.archive ? h('span', { class: 'chip archive' }, 'Archivé') : null),
        h('div', { class: 'titre' }, p.intitule || 'Sans intitulé'),
        h('div', { class: 'meta' }, [p.ouvrage, p.localisation, p.support === 'beton' ? 'Béton' : p.support === 'acier' ? 'Acier' : '', `${done}/${applic.length} contrôles`, 'modifié le ' + fmtDateTime(p.modifieLe)].filter(Boolean).join(' — ')),
        h('div', { class: 'progress' }, h('div', { style: `width:${applic.length ? Math.round(done / applic.length * 100) : 0}%` }))),
      h('div', { class: 'actions' },
        h('a', { class: 'btn small primary', href: `#/pv/${p.id}` }, 'Ouvrir / reprendre'),
        h('button', { class: 'btn small', onclick: () => duplicate(p) }, 'Dupliquer'),
        h('button', { class: 'btn small', onclick: () => toggleArchive(p) }, p.archive ? 'Désarchiver' : 'Archiver'),
        exportMenu(p),
        h('button', { class: 'btn small', onclick: () => backup(p) }, '💾 Sauvegarder'),
        h('button', { class: 'btn small danger', onclick: () => remove(p) }, 'Supprimer')));
  }

  async function duplicate(p) {
    const c = await store.duplicatePV(p.id);
    toast(`Dossier dupliqué : ${c.numero}`, 'ok');
    location.hash = '#/dossiers';
    await render(ctx);
  }
  async function toggleArchive(p) {
    p.archive = !p.archive;
    await store.savePV(p);
    toast(p.archive ? 'Dossier archivé.' : 'Dossier désarchivé.', 'ok');
    renderList(ctx.view.querySelector('.search-input')?.value || '', document.getElementById('flt-archive')?.checked);
  }
  async function remove(p) {
    const ok = await confirmDialog({
      title: 'Supprimer le dossier ?',
      body: `Le dossier <b>${p.numero}</b> (${p.photos?.length || 0} photo(s)) sera définitivement supprimé de cet appareil. Exportez une sauvegarde avant si vous souhaitez le conserver.`,
      confirmLabel: 'Supprimer définitivement', danger: true,
    });
    if (!ok) return;
    await store.deletePV(p.id);
    toast('Dossier supprimé.', 'ok');
    renderList(ctx.view.querySelector('.search-input')?.value || '', document.getElementById('flt-archive')?.checked);
  }
  async function backup(p) {
    const u8 = await store.exportDossier(p.id, { passphrase: '' });
    downloadBlob(new Blob([u8], { type: 'application/zip' }), `${slug(p.numero)}_sauvegarde.pvpack`);
    toast('Archive de sauvegarde exportée (.pvpack).', 'ok');
  }

  function exportMenu(p) {
    const wrap = h('div', { class: 'row', style: 'gap:4px' });
    const btn = h('button', { class: 'btn small', onclick: (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    } }, '📄 Exporter ▾');
    const menu = h('div', { class: 'card hidden', style: 'position:absolute;z-index:30;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:220px' },
      h('button', { class: 'btn small', onclick: () => doExport(p, 'pdf') }, 'PDF'),
      h('button', { class: 'btn small', onclick: () => doExport(p, 'docx') }, 'Word (.docx)'),
      h('button', { class: 'btn small', onclick: () => doExport(p, 'odt') }, 'LibreOffice (.odt)'));
    menu.classList.add('hidden');
    menu.style.display = 'none';
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'; });
    document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: false });
    const holder = h('div', { style: 'position:relative' }, btn, menu);
    return holder;
  }

  async function doExport(p, format) {
    try {
      toast('Génération du document…');
      const pv = await store.getPV(p.id);
      const refEff = store.refEffectifPV(pv);
      const model = buildDocModel(pv, refEff, settings, agents, { inclureNonRenseignes: settings.afficherNonRenseignes });
      const base = `${slug(pv.numero)}_${format}`;
      if (format === 'pdf') { const { exportPDF } = await import('../export/pdf.js'); await exportPDF(model, pv, base + '.pdf'); }
      else if (format === 'docx') { const { exportDOCX } = await import('../export/docx.js'); await exportDOCX(model, pv, base + '.docx'); }
      else { const { exportODT } = await import('../export/odt.js'); await exportODT(model, pv, base + '.odt'); }
      pv.editeLe = new Date().toISOString();
      if (pv.statut !== 'finalise') pv.statut = 'edite';
      await store.savePV(pv);
      toast(`Export ${format.toUpperCase()} généré (statut « Édité »).`, 'ok');
    } catch (e) {
      console.error(e);
      toast('Erreur d export : ' + (e.message || e), 'err');
    }
  }

  renderList();
  if (params.get('new') === '1') showCreate(ctx);
}

/* ---------- formulaire de création ---------- */
function showCreate(ctx) {
  const famOptions = (window.__familles || []).map((f) => ({ value: f.id, label: `${f.code} — ${f.nom}` }));
  store.getReferentiel().then((ref) => {
    const modalRoot = document.getElementById('modal-root');
    const fams = ref.familles.map((f) => ({ value: f.id, label: `${f.code} — ${f.nom}` }));
    const backdrop = h('div', { class: 'modal-backdrop' });
    const numero = textInput('', { placeholder: 'auto si vide' });
    const intitule = textInput('');
    const ouvrage = textInput('');
    const localisation = textInput('');
    const support = select(SUPPORTS.map((s) => ({ value: s.id, label: s.label })), '');
    const famille = select(fams, '');
    const modal = h('div', { class: 'modal' },
      h('h3', {}, 'Nouveau procès-verbal'),
      field('Numéro du PV', numero, { hint: 'Laissé vide : numéro automatique (préfixe des paramètres).' }),
      field('Intitulé de l opération *', intitule, { required: true }),
      field('Nom de l ouvrage *', ouvrage, { required: true }),
      field('Localisation', localisation),
      field('Support *', support, { required: true, hint: 'Conditionne automatiquement le référentiel de contrôles proposé (béton / acier / communs).' }),
      field("Famille de procédé d’étanchéité *", famille, { required: true, hint: 'Charge la liste des contrôles spécifiques à la famille retenue.' }),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!intitule.value.trim() || !ouvrage.value.trim() || !support.value || !famille.value) {
            toast('Merci de renseigner les champs obligatoires (*).', 'err'); return;
          }
          const pv = await store.createPV({
            numero: numero.value.trim() || undefined,
            intitule: intitule.value.trim(), ouvrage: ouvrage.value.trim(),
            localisation: localisation.value.trim(), support: support.value, familleId: famille.value,
          });
          toast(`PV ${pv.numero} créé.`, 'ok');
          backdrop.remove();
          location.hash = `#/pv/${pv.id}/general`;
        } }, 'Créer le dossier')));
    backdrop.append(modal);
    modalRoot.append(backdrop);
  });
}
