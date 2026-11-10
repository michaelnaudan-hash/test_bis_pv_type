/* Tableau de bord : création d’un PV, KPIs, recherche, PV récents, démo. */
import * as store from '../store.js';
import { h, toast, confirmDialog } from '../ui.js';
import { listPVs, getReferentiel } from '../store.js';
import { controlesApplicables, etatAvancement, ETAT_LABELS } from '../model.js';
import { fmtDate, fmtDateTime, esc } from '../util.js';

export async function render(ctx) {
  const pvs = await listPVs();
  const ref = await getReferentiel();
  const settings = await store.getSettings();

  const nonArchives = pvs.filter((p) => !p.archive);
  const enCours = nonArchives.filter((p) => ['en_cours', 'a_completer', 'preparation'].includes(etatAvancement(p, ref)));

  ctx.view.append(
    h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, 'Tableau de bord'),
    h('div', { class: 'alert info' },
      'Application autonome hors connexion : création, saisie, photos, dictée vocale et génération PDF / Word / ODT fonctionnent sans Internet. ',
      h('b', {}, 'Vos données sont stockées localement sur cet appareil — pensez aux sauvegardes régulières (menu 💾).')),
    h('div', { class: 'card' },
      h('h2', {}, 'Nouveau procès-verbal'),
      h('p', { class: 'hint' }, 'Le référentiel de contrôles livré (58 points, 7 phases, 5 familles de procédés) est automatiquement figé dans le nouveau dossier.'),
      h('button', { class: 'btn primary big', onclick: () => location.hash = '#/dossiers?new=1' }, '+ Créer un nouveau PV de contrôle')),
    h('div', { class: 'kpi-row', style: 'margin-bottom:14px' },
      kpi(nonArchives.length, 'Dossiers actifs'),
      kpi(enCours.length, 'PV en cours / à compléter'),
      kpi(pvs.filter((p) => etatAvancement(p, ref) === 'finalise' || etatAvancement(p, ref) === 'edite').length, 'PV finalisés / édités'),
      kpi(pvs.filter((p) => p.archive).length, 'Archivés'),
      kpi(ref.controles.filter((c) => c.actif !== false).length, 'Points de contrôle (référentiel)')),
    h('div', { class: 'card' },
      h('h2', {}, 'Rechercher un PV'),
      searchBox(pvs)),
    h('div', { class: 'card' },
      h('h2', {}, 'Dossiers récents'),
      recentList(pvs.slice(0, 8), ref)),
    h('div', { class: 'card' },
      h('h2', {}, 'Jeu de données de démonstration'),
      h('p', { class: 'hint' }, "Crée un dossier d’exemple clairement étiqueté « DÉMONSTRATION » (données fictives, non présentées comme des contrôles réels) : plusieurs dates d’intervention, plusieurs phases renseignées et photographies légendées."),
      h('button', { class: 'btn', onclick: async (e) => {
        e.target.disabled = true;
        try {
          const { seedDemo } = await import('../demo.js');
          const pv = await seedDemo();
          toast(`Dossier de démonstration créé : ${pv.numero}`, 'ok');
          location.hash = `#/pv/${pv.id}`;
        } catch (err) { toast('Erreur: ' + err.message, 'err'); e.target.disabled = false; }
      } }, '🧪 Générer le dossier de démonstration')),
  );
}

function kpi(v, l) {
  return h('div', { class: 'kpi' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'l' }, l));
}

function searchBox(pvs) {
  const input = h('input', { type: 'text', class: 'search-input', placeholder: 'N° PV, opération, ouvrage, date (AAAA-MM-JJ)…' });
  const result = h('div', { style: 'margin-top:10px' });
  const doSearch = () => {
    const q = input.value.trim().toLowerCase();
    result.innerHTML = '';
    if (!q) return;
    const found = pvs.filter((p) =>
      [p.numero, p.intitule, p.ouvrage, p.localisation, p.entreprise, p.maitreOuvrage, ...(p.interventions || []).map((i) => i.date)].join(' ').toLowerCase().includes(q));
    if (!found.length) { result.append(h('div', { class: 'empty' }, 'Aucun résultat.')); return; }
    for (const p of found.slice(0, 20)) result.append(pvRow(p, null));
  };
  input.addEventListener('input', doSearch);
  return h('div', {}, input, result);
}

export function recentList(pvs, ref) {
  if (!pvs.length) return h('div', { class: 'empty' }, 'Aucun dossier pour le moment. Créez votre premier PV.');
  const wrap = h('div', {});
  for (const p of pvs) wrap.append(pvRow(p, ref));
  return wrap;
}

export function pvRow(p, ref) {
  const etat = ref ? etatAvancement(p, ref) : p.statut;
  const applic = ref ? controlesApplicables(ref.controles, p).length : 0;
  const done = ref ? controlesApplicables(ref.controles, p).filter((c) => p.resultats?.[c.id]?.statut).length : 0;
  const pct = applic ? Math.round((done / applic) * 100) : 0;
  return h('div', { class: 'card pv-item' },
    h('div', { class: 'main' },
      h('div', {}, h('span', { class: 'num' }, p.numero || '(sans n°)'), ' ', p.demo ? h('span', { class: 'chip demo' }, 'DÉMO') : null, ' ', h('span', { class: `chip ${etat}` }, ETAT_LABELS[etat] || etat)),
      h('div', { class: 'titre' }, p.intitule || 'Sans intitulé'),
      h('div', { class: 'meta' }, [p.ouvrage, p.localisation, p.support === 'beton' ? 'Support béton' : p.support === 'acier' ? 'Support acier' : '', p.modifieLe ? 'modifié le ' + fmtDateTime(p.modifieLe) : ''].filter(Boolean).join(' — ')),
      ref ? h('div', { class: 'progress', title: `${done}/${applic} contrôles renseignés` }, h('div', { style: `width:${pct}%` })) : null),
    h('div', { class: 'actions' },
      h('a', { class: 'btn small primary', href: `#/pv/${p.id}` }, 'Ouvrir'),
      h('a', { class: 'btn small', href: `#/dossiers` }, 'Gérer')));
}
