/* Gestion des procédés d’étanchéité : les 5 familles livrées (issues du référentiel Excel)
 * + procédés/systèmes personnalisés rattachés à une famille (fabricant, référence commerciale). */
import * as store from '../store.js';
import { h, toast, confirmDialog, field, textInput, textarea, select } from '../ui.js';
import { fmtDateTime } from '../util.js';

export async function render(ctx) {
  const ref = await store.getReferentiel();
  const procedes = await store.listProcedures();

  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, "Procédés d’étanchéité"));

  ctx.view.append(h('div', { class: 'card' },
    h('h2', {}, 'Familles de procédés (référentiel livré)'),
    h('p', { class: 'hint' }, "Chaque famille dispose de sa propre liste de contrôles dans le référentiel. L’applicabilité selon le support est à confirmer par l’avis technique du procédé."),
    h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, '<th>Famille</th><th>Nom</th><th>Béton</th><th>Acier</th><th>Points d attention</th><th>Nb contrôles</th>')),
      h('tbody', {}, ref.familles.map((f) => h('tr', {},
        h('td', { class: 'mono' }, f.code),
        h('td', {}, f.nom),
        h('td', {}, f.supports.beton === true ? '✔' : f.supports.beton),
        h('td', {}, f.supports.acier === true ? '✔' : f.supports.acier),
        h('td', { style: 'font-size:0.82rem' }, f.description),
        h('td', {}, String(ref.controles.filter((c) => c.famille === 'toutes' || c.famille === f.id).length))
      ))))));

  const toolbar = h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', onclick: () => edit(null) }, '+ Ajouter un procédé / système'));
  ctx.view.append(h('div', { class: 'card' }, h('h2', {}, 'Procédés / systèmes personnalisés'), toolbar, list()));

  function list() {
    if (!procedures.length) return h('div', { class: 'empty' }, 'Aucun procédé personnalisé. Ajoutez les systèmes retenus sur vos chantiers (fabricant, référence commerciale, avis technique).');
    const wrap = h('div', {});
    for (const p of procedes) {
      const fam = ref.familles.find((f) => f.id === p.familleId);
      wrap.append(h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('b', { style: 'flex:1' }, p.nom), h('span', { class: 'tag' }, fam ? fam.code : p.familleId)),
        h('div', { class: 'meta' }, [p.fabricant, p.referenceCommerciale, p.avisTechnique, p.cahierPose].filter(Boolean).join(' — ')),
        p.description ? h('div', { style: 'font-size:0.9rem;margin-top:4px' }, p.description) : null,
        h('div', { class: 'row', style: 'margin-top:6px' },
          h('button', { class: 'btn small', onclick: () => edit(p) }, 'Modifier'),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (await confirmDialog({ title: 'Supprimer ce procédé ?', danger: true, confirmLabel: 'Supprimer' })) { await store.delProcedure(p.id); toast('Procédé supprimé.', 'ok'); render(ctx); }
          } }, 'Supprimer'))));
    }
    return wrap;
  }

  function edit(p) {
    const isNew = !p;
    const d = p || { nom: '', familleId: ref.familles[0]?.id || '', fabricant: '', referenceCommerciale: '', avisTechnique: '', cahierPose: '', description: '' };
    const backdrop = h('div', { class: 'modal-backdrop' });
    const nom = textInput(d.nom), fam = select(ref.familles.map((f) => ({ value: f.id, label: `${f.code} — ${f.nom}` })), d.familleId);
    const fab = textInput(d.fabricant), refCom = textInput(d.referenceCommerciale), at = textInput(d.avisTechnique), cahier = textInput(d.cahierPose), desc = textarea(d.description, { rows: 3 });
    const modal = h('div', { class: 'modal' },
      h('h3', {}, isNew ? 'Nouveau procédé / système' : 'Modifier le procédé'),
      field('Nom du procédé / système *', nom, { required: true }),
      field('Famille (référentiel de contrôles associé) *', fam, { required: true }),
      h('div', { class: 'grid2' },
        field('Fabricant', fab), field('Référence commerciale', refCom),
        field('Avis technique (AT / ATEx / DTA)', at), field('Cahier de pose (indice)', cahier)),
      field('Description', desc),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!nom.value.trim() || !fam.value) { toast('Nom et famille obligatoires.', 'err'); return; }
          await store.putProcedure({ ...d, nom: nom.value.trim(), familleId: fam.value, fabricant: fab.value.trim(), referenceCommerciale: refCom.value.trim(), avisTechnique: at.value.trim(), cahierPose: cahier.value.trim(), description: desc.value.trim() });
          toast('Procédé enregistré.', 'ok');
          backdrop.remove();
          render(ctx);
        } }, 'Enregistrer')));
    backdrop.append(modal);
    document.getElementById('modal-root').append(backdrop);
  }
}
