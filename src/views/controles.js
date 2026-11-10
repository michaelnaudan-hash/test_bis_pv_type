/* Saisie des contrôles sur chantier : par phase et par rubrique.
 * Statuts, mesure quantifiée avec conformité automatique (uniquement si critère quantifié),
 * commentaires avec dictée vocale, agents, intervention, accès rapide aux photos. */
import * as store from '../store.js';
import { h, toast, field, numInput, select, micField } from '../ui.js';
import { STATUTS, STATUT_LABELS, controlesApplicables, evaluerConformite, estRenseigne } from '../model.js';
import { fmtDate, debounce } from '../util.js';
import { pickPhoto } from '../photos.js';

export function renderControles(ctx, container, pv, ref, agents, reload) {
  const settings = store.getSettings ? null : null;
  store.getSettings().then((s) => draw(s));

  async function draw(settings) {
    container.innerHTML = '';
    const applic = controlesApplicables(ref.controles, pv);
    const showAll = settings.afficherNonRenseignes;

    const header = h('div', { class: 'toolbar' },
      h('span', { class: 'hint' }, `${applic.length} points applicables (support « ${pv.support === 'beton' ? 'Béton' : pv.support === 'acier' ? 'Acier' : '—'} », famille ${pv.familleId || '—'})`),
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: !!settings.afficherNonRenseignes, onchange: async (e) => { await store.putSetting('afficherNonRenseignes', e.target.checked); draw(await store.getSettings()); } }),
        'Afficher aussi les contrôles non renseignés (masqués du document final)'));
    container.append(header);

    const byPhase = ref.phases.map((ph) => ({ phase: ph, items: applic.filter((c) => c.phaseId === ph.id) })).filter((x) => x.items.length);
    const ctrlRefs = [];

    for (const { phase, items } of byPhase) {
      const renseignes = items.filter((c) => estRenseigne(pv.resultats?.[c.id])).length;
      const phaseEl = h('div', { class: 'phase-block' },
        h('div', { class: 'phase-head' }, phase.titre, h('span', { class: 'count' }, `${renseignes}/${items.length} renseigné(s)`)));
      container.append(phaseEl);
      for (const ctrl of items) {
        const res = pv.resultats?.[ctrl.id] || null;
        if (!showAll && !estRenseigne(res)) continue;
        const el = ctrlCard(ctrl, res);
        ctrlRefs.push({ ctrl, el });
        phaseEl.append(el);
      }
    }

    if (!ctrlRefs.length) container.append(h('div', { class: 'card empty' }, 'Aucun contrôle renseigné pour le moment.'));

    function ctrlCard(ctrl, res) {
      const wrap = h('div', { class: 'ctrl' + (estRenseigne(res) ? ' done' : ''), id: 'ctrl-' + ctrl.id });
      const badges = [
        ctrl.pointArret ? '<span class="tag pa">PA — point d arrêt</span>' : '',
        ctrl.pointCritique ? '<span class="tag pc">PC — point critique</span>' : '',
        ctrl.obligatoire ? '<span class="tag">Obligatoire</span>' : '<span class="tag">Facultatif</span>',
        ctrl.support !== 'commun' ? `<span class="tag">${ctrl.support === 'beton' ? 'Béton' : 'Acier'}</span>` : '',
      ].join(' ');

      wrap.append(
        h('div', { class: 'ctrl-head' },
          h('span', { class: 'code' }, ctrl.code),
          h('span', { class: 'titre' }, ctrl.intitule),
          h('span', { html: badges })),
        h('div', { class: 'exigence' }, h('b', {}, 'Critère d acceptation (indicatif) : '), ctrl.exigence || '—',
          ctrl.valeurContractuelle ? h('div', { class: 'hint' }, 'Valeur contractuelle applicable : ' + ctrl.valeurContractuelle) : null),
        h('div', { class: 'meta-line' }, `Méthode : ${ctrl.methode || '—'} · Fréquence : ${ctrl.frequence || '—'} · Source : ${ctrl.source || '—'}`),
      );

      // boutons de statut
      const seg = h('div', { class: 'seg', style: 'margin-top:8px' });
      for (const s of STATUTS) {
        const b = h('button', { type: 'button', class: res?.statut === s ? 'sel-' + s : '', onclick: async () => {
          await store.setResultat(pv.id, ctrl.id, { statut: s, dateControle: new Date().toISOString().slice(0, 10) });
          await reload();
        } }, STATUT_LABELS[s]);
        seg.append(b);
      }
      wrap.append(field('Résultat du contrôle', seg));

      // mesure quantifiée
      const grid = h('div', { class: 'ctrl-grid' });
      if (ctrl.mesure && ctrl.mesure.type && ctrl.mesure.type !== 'aucune') {
        const mi = numInput(res?.mesure ?? '', { placeholder: ctrl.mesure.unite || '' });
        mi.addEventListener('input', debounce(async () => {
          const v = mi.value === '' ? null : Number(mi.value);
          const auto = evaluerConformite(ctrl, v);
          const patch = { mesure: v, unite: ctrl.mesure.unite || '' };
          if (auto && res?.statut !== 'non_conforme' && res?.statut !== 'conforme') patch.statut = auto; // auto seulement si pas de statut manuel contradictoire
          else if (auto && !res?.statut) patch.statut = auto;
          await store.setResultat(pv.id, ctrl.id, patch);
          toast(auto ? `Évaluation automatique : ${STATUT_LABELS[auto]} (${v} ${ctrl.mesure.unite || ''})` : 'Mesure enregistrée — statut à définir manuellement.', auto ? 'ok' : '');
          await reload();
        }, 600));
        grid.append(field(`Mesure constatée (${ctrl.mesure.unite || 'unité'})`, mi, { hint: 'La conformité est proposée automatiquement uniquement quand le critère est quantifié ; sinon, choisissez le statut.' }));
      } else {
        const mi = numInput(res?.mesure ?? '', { placeholder: res?.unite || '' });
        mi.addEventListener('input', debounce(async () => {
          await store.setResultat(pv.id, ctrl.id, { mesure: mi.value === '' ? null : Number(mi.value) });
          await reload();
        }, 600));
        grid.append(field('Mesure constatée (facultative)', mi));
      }
      // intervention liée
      const ivSel = select([{ value: '', label: '— date d intervention —' }, ...(pv.interventions || []).map((i) => ({ value: i.id, label: fmtDate(i.date) + (i.heure ? ' ' + i.heure : '') }))], res?.interventionId || '');
      ivSel.addEventListener('change', async () => { await store.setResultat(pv.id, ctrl.id, { interventionId: ivSel.value || null }); });
      grid.append(field("Date d’intervention liée", ivSel));
      // agents
      const agSel = select([{ value: '', label: '— agent responsable —' }, ...agents.filter((a) => a.role === 'controle').map((a) => ({ value: a.id, label: `${a.prenom || ''} ${a.nom || ''}`.trim() + (a.societe ? ' (' + a.societe + ')' : '') }))], res?.agentIds?.[0] || '');
      agSel.addEventListener('change', async () => { await store.setResultat(pv.id, ctrl.id, { agentIds: agSel.value ? [agSel.value] : [] }); });
      grid.append(field('Agent responsable', agSel));
      wrap.append(grid);

      // commentaire avec dictée
      const com = micField({ value: res?.commentaire || '', multiline: true, voice: ctx.voice, onText: debounce(async (v) => { await store.setResultat(pv.id, ctrl.id, { commentaire: v }); }, 400) });
      wrap.append(h('div', { style: 'margin-top:8px' }, h('span', { style: 'font-weight:600;font-size:0.9rem;display:block;margin-bottom:4px;color:var(--primary-dark)' }, 'Commentaire'), com));

      // photos du contrôle + ajout rapide
      const nbPhotos = (pv.photos || []).filter((p) => p.controlId === ctrl.id).length;
      const row = h('div', { class: 'row', style: 'margin-top:8px' },
        h('span', { class: 'hint' }, `${nbPhotos} photo(s) rattachée(s) (affichées en fin de phase dans le PV)`),
        h('button', { class: 'btn small', onclick: async () => {
          try {
            const file = await pickPhoto(true);
            await store.addPhoto(pv.id, { file, controlId: ctrl.id, phaseId: ctrl.phaseId });
            toast('Photo ajoutée et rattachée à ce contrôle.', 'ok');
            await reload();
          } catch (e) { if (e.message) toast(e.message, 'err'); }
        } }, '📷 Ajouter une photo'),
        h('button', { class: 'btn small', onclick: () => {
          const nxt = ctrlRefs[ctrlRefs.findIndex((x) => x.ctrl.id === ctrl.id) + 1];
          if (nxt) nxt.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } }, 'Point suivant ➡️'));
      wrap.append(row);
      return wrap;
    }
  }
}
