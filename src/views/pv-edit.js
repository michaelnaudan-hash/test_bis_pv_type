/* Édition d’un dossier PV : onglets Général / Interventions / Contrôles / Photos / Conclusion / Exporter. */
import * as store from '../store.js';
import { h, toast, confirmDialog, field, textInput, numInput, dateInput, timeInput, textarea, select, micField } from '../ui.js';
import { STATUTS, STATUT_LABELS, SUPPORTS, controlesApplicables, etatAvancement, ETAT_LABELS, conclusionAuto, coherencePV, supportLabel, evaluerConformite } from '../model.js';
import { fmtDate, fmtDateTime, debounce, slug, downloadBlob } from '../util.js';
import { buildDocModel } from '../docmodel.js';
import { pickPhoto } from '../photos.js';
import { renderControles } from './controles.js';

const TABS = [
  ['general', '📋 Général'],
  ['interventions', '📅 Interventions'],
  ['controles', '✅ Contrôles'],
  ['photos', '📷 Photos'],
  ['conclusion', '📝 Conclusion'],
  ['exporter', '📄 Exporter'],
];

export async function render(ctx, { id, tab }) {
  let pv = await store.getPV(id);
  if (!pv) { ctx.view.append(h('div', { class: 'alert err' }, 'Dossier introuvable.')); return; }
  const ref = store.refEffectifPV(pv);
  const agents = await store.listAgents();
  const settings = await store.getSettings();

  const reload = async () => { pv = await store.getPV(id); draw(); };

  const root = h('div', {});
  ctx.view.append(root);

  function draw() {
    root.innerHTML = '';
    const etat = etatAvancement(pv, ref);
    const problems = coherencePV(pv, ref);
    root.append(
      h('div', { class: 'row', style: 'margin-bottom:8px' },
        h('h1', { style: 'margin:0;color:var(--primary-dark);font-size:1.3rem;flex:1' }, `${pv.numero} — ${pv.intitule || 'Sans intitulé'}`),
        pv.demo ? h('span', { class: 'chip demo' }, 'DÉMONSTRATION') : null,
        h('span', { class: `chip ${etat}` }, ETAT_LABELS[etat] || etat)),
      problems.length ? h('div', { class: 'alert warn' }, h('b', {}, 'Points de vigilance :'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, problems.map((p) => h('li', {}, p)))) : null,
      h('div', { class: 'tabs' }, TABS.map(([t, label]) =>
        h('a', { href: `#/pv/${id}/${t}`, class: tab === t ? 'active' : '' }, label))),
    );
    const body = h('div', {});
    root.append(body);
    ({ general: drawGeneral, interventions: drawInterventions, controles: drawControles, photos: drawPhotos, conclusion: drawConclusion, exporter: drawExporter })[tab || 'general'](body);
  }

  /* ================= GÉNÉRAL ================= */
  function drawGeneral(body) {
    const save = debounce(async () => { await store.savePV(pv); }, 500);
    const bind = (input, key) => input.addEventListener('input', () => { pv[key] = input.value; save(); });

    const f = {};
    const mk = (key, label, input, opts) => { f[key] = input; bind(input, key); return field(label, input, opts); };

    const supportSel = select(SUPPORTS.map((s) => ({ value: s.id, label: s.label })), pv.support);
    supportSel.addEventListener('change', async () => {
      const newSupport = supportSel.value;
      if (!newSupport || newSupport === pv.support) return;
      const newApplic = new Set(controlesApplicables(ref.controles, { support: newSupport, familleId: pv.familleId }).map((c) => c.id));
      const affected = Object.keys(pv.resultats || {}).filter((cid) => !newApplic.has(cid));
      if (affected.length) {
        const choix = await confirmDialog({
          title: 'Changement de support',
          body: `${affected.length} contrôle(s) renseigné(s) sortent du périmètre « ${supportLabel(newSupport)} ».<br>Que faire des données déjà saisies ?<br><br>• <b>Conserver</b> : elles restent dans le dossier mais sont masquées du PV.<br>• <b>Supprimer</b> : les résultats concernés sont supprimés.`,
          confirmLabel: 'Conserver (masquées du PV)',
        });
        if (!choix) { supportSel.value = pv.support; return; }
        // conserver : rien à supprimer ; on journalise juste le changement
      } else {
        const ok = await confirmDialog({ title: 'Changer le support ?', body: `Le support passe à « ${supportLabel(newSupport)} ». Le référentiel du PV sera re-filtré en conséquence.`, confirmLabel: 'Changer' });
        if (!ok) { supportSel.value = pv.support; return; }
      }
      pv.support = newSupport;
      await store.savePV(pv);
      toast(`Support : ${supportLabel(newSupport)}. Les contrôles affichés sont re-filtrés.`, 'ok');
      draw();
    });

    const famSel = select(ref.familles.map((x) => ({ value: x.id, label: `${x.code} — ${x.nom}` })), pv.familleId);
    famSel.addEventListener('change', async () => {
      const nf = famSel.value;
      if (!nf || nf === pv.familleId) return;
      const newApplic = new Set(controlesApplicables(ref.controles, { support: pv.support, familleId: nf }).map((c) => c.id));
      const affected = Object.keys(pv.resultats || {}).filter((cid) => !newApplic.has(cid));
      if (affected.length) {
        const ok = await confirmDialog({ title: 'Changement de procédé', body: `${affected.length} contrôle(s) renseigné(s) sortent du périmètre de la nouvelle famille. Ils seront conservés mais masqués du PV. Continuer ?`, confirmLabel: 'Continuer' });
        if (!ok) { famSel.value = pv.familleId; return; }
      }
      pv.familleId = nf;
      await store.savePV(pv);
      draw();
    });

    const card = h('div', { class: 'card' },
      h('div', { class: 'row', style: 'margin-bottom:8px' },
        h('h2', { style: 'margin:0;flex:1' }, 'Informations générales'),
        h('button', { class: 'btn small', onclick: prefillLast }, 'Préremplir depuis le dernier dossier')),
      h('div', { class: 'grid2' },
        mk('numero', 'Numéro du PV', textInput(pv.numero)),
        mk('intitule', "Intitulé de l’opération", textInput(pv.intitule)),
        mk('ouvrage', "Nom de l’ouvrage", textInput(pv.ouvrage)),
        mk('localisation', 'Localisation', textInput(pv.localisation)),
        mk('maitreOuvrage', "Maître d’ouvrage", textInput(pv.maitreOuvrage)),
        mk('maitreOeuvre', "Maître d'œuvre", textInput(pv.maitreOeuvre)),
        mk('entreprise', 'Entreprise titulaire du marché', textInput(pv.entreprise)),
        mk('entrepriseEtancheite', "Entreprise spécialisée en étanchéité", textInput(pv.entrepriseEtancheite)),
        mk('lot', 'Lot concerné', textInput(pv.lot)),
        mk('natureTravaux', 'Nature des travaux', textInput(pv.natureTravaux)),
        h('label', { class: 'fld' }, h('span', {}, 'Support *'), supportSel),
        h('label', { class: 'fld' }, h('span', {}, "Famille de procédé *"), famSel),
        mk('procedeNom', "Procédé / système retenu (nom précis)", textInput(pv.procedeNom || '')),
        mk('fabricant', 'Fabricant', textInput(pv.fabricant)),
        mk('referenceSysteme', 'Référence commerciale du système', textInput(pv.referenceSysteme)),
        mk('refsDocTechniques', 'Références des documents techniques (CCTP, AT…)', textarea(pv.refsDocTechniques || '', { rows: 2 })),
        mk('meteo', 'Conditions météorologiques', textInput(pv.meteo)),
      ),
      field('Observations générales', micField({ value: pv.observations || '', multiline: true, voice: ctx.voice, onText: (v) => { pv.observations = v; save(); } })),
    );
    body.append(card);

    async function prefillLast() {
      const all = await store.listPVs();
      const last = all.find((p) => p.id !== pv.id && (p.maitreOuvrage || p.entreprise || p.localisation));
      if (!last) { toast('Aucun dossier précédent exploitable.', 'err'); return; }
      for (const k of ['maitreOuvrage', 'maitreOeuvre', 'entreprise', 'entrepriseEtancheite', 'lot', 'natureTravaux', 'localisation']) {
        if (!pv[k] && last[k]) { pv[k] = last[k]; if (f[k]) f[k].value = last[k]; }
      }
      await store.savePV(pv);
      toast('Champs préremplis depuis ' + last.numero, 'ok');
    }
  }

  /* ================= INTERVENTIONS ================= */
  function drawInterventions(body) {
    body.append(h('div', { class: 'toolbar' },
      h('button', { class: 'btn primary', onclick: () => editIntervention(null) }, '+ Ajouter une date d intervention')));
    const list = h('div', {});
    body.append(list);
    if (!pv.interventions?.length) list.append(h('div', { class: 'card empty' }, "Aucune intervention. Un PV peut comporter plusieurs dates d’intervention."));
    for (const iv of [...(pv.interventions || [])].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      list.append(h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('b', { style: 'flex:1' }, `${fmtDate(iv.date)}${iv.heure ? ' à ' + iv.heure : ''}`),
          h('button', { class: 'btn small', onclick: () => editIntervention(iv) }, 'Modifier'),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (await confirmDialog({ title: 'Supprimer cette intervention ?', body: 'Les contrôles et photos rattachés à cette date seront dissociés (non supprimés).', danger: true, confirmLabel: 'Supprimer' })) {
              await store.delIntervention(pv.id, iv.id); await reload();
            }
          } }, 'Supprimer')),
        iv.description ? h('div', { class: 'meta', style: 'margin-top:6px' }, iv.description) : null,
        h('div', { class: 'meta' }, 'Contrôle : ' + names(iv.agentIds) + (iv.clientIds?.length ? ' — Client : ' + names(iv.clientIds) : '')),
        iv.observations ? h('div', { style: 'margin-top:6px;font-size:0.9rem' }, h('b', {}, 'Observations : '), iv.observations) : null));
    }

    function names(ids) {
      return (ids || []).map((i) => { const a = agents.find((x) => x.id === i); return a ? `${a.prenom || ''} ${a.nom || ''}`.trim() : ''; }).filter(Boolean).join(', ') || '—';
    }

    function editIntervention(iv) {
      const isNew = !iv;
      const data = iv || { id: null, date: new Date().toISOString().slice(0, 10), heure: '', description: '', agentIds: [], clientIds: [], observations: '' };
      const backdrop = h('div', { class: 'modal-backdrop' });
      const d = dateInput(data.date); const hr = timeInput(data.heure);
      const desc = textarea(data.description, { rows: 2 });
      const obs = micField({ value: data.observations, multiline: true, voice: ctx.voice });
      const obsInput = obs.querySelector('textarea');
      const agentSel = multiSelect(agents.filter((a) => a.role === 'controle'), data.agentIds);
      const clientSel = multiSelect(agents.filter((a) => a.role === 'client'), data.clientIds);
      const modal = h('div', { class: 'modal' },
        h('h3', {}, isNew ? 'Nouvelle intervention' : 'Modifier l intervention'),
        h('div', { class: 'grid2' }, field('Date *', d, { required: true }), field('Heure', hr)),
        field('Description de l intervention', desc),
        h('label', { class: 'fld' }, h('span', {}, 'Agents contrôle concernés'), agentSel),
        h('label', { class: 'fld' }, h('span', {}, 'Représentants client concernés'), clientSel),
        h('div', { style: 'margin-bottom:10px' }, h('span', { style: 'font-weight:600;display:block;margin-bottom:4px;color:var(--primary-dark)' }, 'Observations'), obs),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
          h('button', { class: 'btn primary', onclick: async () => {
            const rec = { ...data, date: d.value, heure: hr.value, description: desc.value, observations: obsInput.value, agentIds: agentSel.value, clientIds: clientSel.value };
            if (!rec.date) { toast('Date obligatoire.', 'err'); return; }
            if (isNew) await store.addIntervention(pv.id, rec); else await store.saveIntervention(pv.id, rec);
            backdrop.remove(); await reload();
          } }, 'Enregistrer')));
      backdrop.append(modal);
      document.getElementById('modal-root').append(backdrop);
    }
  }

  function multiSelect(list, selected) {
    const wrap = h('div', { class: 'card', style: 'padding:8px;max-height:180px;overflow:auto' });
    for (const a of list) {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = (selected || []).includes(a.id);
      wrap.append(h('label', { class: 'row', style: 'gap:8px;padding:4px' }, cb, `${a.prenom || ''} ${a.nom || ''}`.trim(), h('span', { class: 'hint' }, a.societe || '')));
    }
    if (!list.length) wrap.append(h('div', { class: 'hint' }, 'Aucun agent dans cette catégorie — voir le menu Agents.'));
    return Object.assign(wrap, { get value() { return [...wrap.querySelectorAll('input:checked')].map((c, i) => list[i].id); } });
  }

  /* ================= CONTRÔLES ================= */
  function drawControles(body) {
    renderControles(ctx, body, pv, ref, agents, reload);
  }

  /* ================= PHOTOS ================= */
  async function drawPhotos(body) {
    const toolbar = h('div', { class: 'toolbar' },
      h('button', { class: 'btn primary', onclick: () => addPhotoFlow(null) }, '📷 Prendre une photo'),
      h('button', { class: 'btn', onclick: () => addPhotoFlow(null, false) }, '🖼️ Importer une image'),
      h('span', { class: 'hint' }, 'Chaque photo doit être rattachée à une phase, un contrôle ou une intervention.'));
    body.append(toolbar);
    const grid = h('div', { class: 'photo-grid', style: 'margin-top:12px' });
    body.append(grid);
    const photos = [...(pv.photos || [])].sort((a, b) => a.ordre - b.ordre);
    if (!photos.length) body.append(h('div', { class: 'card empty' }, 'Aucune photographie.'));
    for (const p of photos) grid.append(await photoCard(p));

    async function photoCard(p) {
      const url = URL.createObjectURL(await store.getPhotoBlob(p.blobKey));
      const card = h('div', { class: 'photo-card' },
        h('img', { src: url }),
        h('div', { class: 'body' },
          h('span', { class: 'num' }, `Photo n°${p.ordre}`),
          h('div', { class: 'meta' }, attachLabel(p)),
          (() => { const ta = textarea(p.legende || '', { rows: 2, placeholder: 'Légende (saisie clavier ou 🎙️)…' }); ta.addEventListener('input', debounce(async () => { await store.updatePhoto(pv.id, p.id, { legende: ta.value }); }, 400)); return h('div', { style: 'display:flex;gap:4px' }, ta, micBtn(ta)); })()),
        h('div', { class: 'actions' },
          h('button', { class: 'btn small', onclick: async () => { await store.movePhoto(pv.id, p.id, -1); await reload(); } }, '⬅️'),
          h('button', { class: 'btn small', onclick: async () => { await store.movePhoto(pv.id, p.id, 1); await reload(); } }, '➡️'),
          h('button', { class: 'btn small', onclick: () => replace(p) }, 'Remplacer'),
          h('button', { class: 'btn small danger', onclick: async () => { if (await confirmDialog({ title: 'Supprimer la photo ?', danger: true, confirmLabel: 'Supprimer' })) { await store.deletePhoto(pv.id, p.id); URL.revokeObjectURL(url); await reload(); } } }, 'Supprimer')));
      return card;
    }

    function micBtn(ta) {
      const b = h('button', { class: 'mic-btn', type: 'button', title: 'Dictée vocale hors connexion' }, '🎙️');
      b.addEventListener('click', async () => {
        if (b.classList.contains('recording')) { ctx.voice.stop(); return; }
        b.classList.add('recording');
        try {
          await ctx.voice.start({
            onPartial: () => {},
            onResult: (t) => { ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + t; ta.dispatchEvent(new Event('input', { bubbles: true })); },
            onEnd: () => b.classList.remove('recording'),
            onError: (e) => { b.classList.remove('recording'); toast('Dictée : ' + e, 'err'); },
          });
        } catch (e) { b.classList.remove('recording'); toast('Dictée : ' + (e.message || e), 'err'); }
      });
      return b;
    }

    function attachLabel(p) {
      const bits = [];
      if (p.controlId) { const c = ref.controles.find((x) => x.id === p.controlId); bits.push(c ? `Contrôle ${c.code}` : p.controlId); }
      if (p.phaseId) { const ph = ref.phases.find((x) => x.id === p.phaseId); bits.push(ph ? 'Phase ' + ph.titre : p.phaseId); }
      if (p.interventionId) { const iv = pv.interventions?.find((x) => x.id === p.interventionId); bits.push('Intervention du ' + (iv ? fmtDate(iv.date) : p.interventionId)); }
      return bits.join(' — ') || '⚠ non rattachée';
    }

    async function replace(p) {
      try {
        const f = await pickPhoto(false);
        await store.replacePhotoBlob(pv.id, p.id, f);
        toast('Photo remplacée.', 'ok');
        await reload();
      } catch (e) { if (e.message) toast(e.message, 'err'); }
    }

    async function addPhotoFlow(preset, camera = true) {
      // choix du rattachement puis prise de vue
      const backdrop = h('div', { class: 'modal-backdrop' });
      const ctrlOpts = controlesApplicables(ref.controles, pv).map((c) => ({ value: 'c:' + c.id, label: `${c.code} — ${c.intitule}` }));
      const phaseOpts = ref.phases.map((ph) => ({ value: 'p:' + ph.id, label: ph.titre }));
      const intOpts = (pv.interventions || []).map((iv) => ({ value: 'i:' + iv.id, label: 'Intervention du ' + fmtDate(iv.date) }));
      const sel = select([{ value: '', label: '— rattacher à… —' }, ...phaseOpts, ...ctrlOpts, ...intOpts], '');
      const leg = textarea('', { rows: 2, placeholder: 'Légende…' });
      const modal = h('div', { class: 'modal' },
        h('h3', {}, 'Nouvelle photographie'),
        field('Rattachement (obligatoire)', sel, { required: true, hint: 'Phase, point de contrôle ou date d intervention.' }),
        field('Légende', leg),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
          h('button', { class: 'btn primary', onclick: async () => {
            if (!sel.value) { toast('Rattachement obligatoire (la photo figurera dans la rubrique concernée du PV).', 'err'); return; }
            try {
              const file = await pickPhoto(camera);
              const [kind, refId] = sel.value.split(':');
              const patch = kind === 'c' ? { controlId: refId, phaseId: ref.controles.find((c) => c.id === refId)?.phaseId || null }
                : kind === 'p' ? { phaseId: refId } : { interventionId: refId };
              await store.addPhoto(pv.id, { file, legende: leg.value, ...patch });
              backdrop.remove();
              toast('Photo enregistrée localement.', 'ok');
              await reload();
            } catch (e) { if (e.message) toast(e.message, 'err'); }
          } }, camera ? 'Prendre la photo' : 'Choisir l image')));
      backdrop.append(modal);
      document.getElementById('modal-root').append(backdrop);
    }
  }

  /* ================= CONCLUSION ================= */
  function drawConclusion(body) {
    const auto = conclusionAuto(pv, ref);
    const card = h('div', { class: 'card' },
      h('h2', {}, 'Conclusion'),
      h('div', { class: 'alert ' + (auto.avis === 'défavorable' ? 'err' : auto.avis === 'en_attente' ? 'warn' : 'info') },
        h('b', {}, 'Conclusion automatique : '), auto.texte.replace(/\n/g, ' ')),
      h('p', { class: 'hint' }, "La conclusion automatique ne déclare jamais l’ouvrage globalement conforme si des contrôles sont non conformes ou en attente. Elle reste modifiable ci-dessous."),
      (() => { const ta = textarea(pv.conclusion || auto.texte, { rows: 6 }); ta.addEventListener('input', debounce(async () => { pv.conclusion = ta.value; await store.savePV(pv); }, 500)); return field('Conclusion du PV (modifiable)', ta); })(),
      (() => { const ta = textarea(pv.synthese || '', { rows: 4 }); ta.addEventListener('input', debounce(async () => { pv.synthese = ta.value; await store.savePV(pv); }, 500)); return field('Synthèse complémentaire (manuelle)', micFieldWrap(ta)); })(),
      h('button', { class: 'btn', onclick: () => { pv.conclusion = auto.texte; store.savePV(pv).then(reload); toast('Conclusion réinitialisée à la valeur automatique.', 'ok'); } }, '↺ Reprendre la conclusion automatique'));
    body.append(card);

    function micFieldWrap(ta) {
      const wrap = h('div', { class: 'field-with-mic' }, ta, micField({ value: '', multiline: false, voice: ctx.voice, onText: () => {} }).querySelector('.mic-btn'));
      const mic = wrap.querySelector('.mic-btn');
      mic.addEventListener('click', async () => {
        if (mic.classList.contains('recording')) { ctx.voice.stop(); return; }
        mic.classList.add('recording');
        try {
          await ctx.voice.start({
            onResult: (t) => { ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + t; ta.dispatchEvent(new Event('input', { bubbles: true })); },
            onEnd: () => mic.classList.remove('recording'),
            onError: (e) => { mic.classList.remove('recording'); toast('Dictée : ' + e, 'err'); },
          });
        } catch (e) { mic.classList.remove('recording'); toast('Dictée : ' + (e.message || e), 'err'); }
      });
      return wrap;
    }
  }

  /* ================= EXPORTER ================= */
  function drawExporter(body) {
    const card = h('div', { class: 'card' },
      h('h2', {}, 'Génération du procès-verbal'),
      h('p', { class: 'hint' }, "Génération 100 % locale (hors connexion). Les rubriques non renseignées n’apparaissent pas dans le document ; les photos figurent en fin de chaque phase concernée."),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => doExport('pdf') }, '📕 PDF'),
        h('button', { class: 'btn', onclick: () => doExport('docx') }, '📝 Word (.docx)'),
        h('button', { class: 'btn', onclick: () => doExport('odt') }, '📄 LibreOffice (.odt)')),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn', onclick: backup }, '💾 Archive de sauvegarde (.pvpack)')));
    body.append(card);

    async function doExport(format) {
      try {
        toast('Génération en cours…');
        const fresh = await store.getPV(pv.id);
        const refEff = store.refEffectifPV(fresh);
        const model = buildDocModel(fresh, refEff, settings, agents, { inclureNonRenseignes: settings.afficherNonRenseignes, logoDataUrl: settings.logoDataUrl });
        const base = `${slug(fresh.numero)}_${format}`;
        if (format === 'pdf') { const { exportPDF } = await import('../export/pdf.js'); await exportPDF(model, fresh, base + '.pdf'); }
        else if (format === 'docx') { const { exportDOCX } = await import('../export/docx.js'); await exportDOCX(model, fresh, base + '.docx'); }
        else { const { exportODT } = await import('../export/odt.js'); await exportODT(model, fresh, base + '.odt'); }
        fresh.editeLe = new Date().toISOString();
        fresh.statut = 'edite';
        await store.savePV(fresh);
        toast(`Export ${format.toUpperCase()} OK — dossier passé en statut « Édité ».`, 'ok');
        draw();
      } catch (e) { console.error(e); toast('Erreur : ' + (e.message || e), 'err'); }
    }

    async function backup() {
      const u8 = await store.exportDossier(pv.id, { passphrase: '' });
      downloadBlob(new Blob([u8], { type: 'application/zip' }), `${slug(pv.numero)}_sauvegarde.pvpack`);
      toast('Archive exportée.', 'ok');
    }
  }

  draw();
}
