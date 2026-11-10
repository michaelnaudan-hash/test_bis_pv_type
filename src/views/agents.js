/* Gestion des agents classés par rôle : Client (MOA/client) et Contrôle (suivi/vérification). */
import * as store from '../store.js';
import { h, toast, confirmDialog, field, textInput } from '../ui.js';

export async function render(ctx) {
  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, 'Agents & intervenants'));
  const agents = await store.listAgents();
  ctx.view.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', onclick: () => edit(null) }, '+ Ajouter un agent')));

  for (const role of ['client', 'controle']) {
    const list = agents.filter((a) => a.role === role);
    ctx.view.append(h('div', { class: 'card' },
      h('h2', {}, role === 'client' ? 'Représentants du maître d ouvrage / client' : 'Chargés de contrôle / vérification'),
      !list.length ? h('div', { class: 'empty' }, 'Aucun agent.') : h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, '<th>Nom</th><th>Prénom</th><th>Fonction</th><th>Société</th><th>Coordonnées</th><th></th>')),
        h('tbody', {}, list.map((a) => h('tr', {},
          h('td', {}, a.nom || ''), h('td', {}, a.prenom || ''), h('td', {}, a.fonction || ''), h('td', {}, a.societe || ''),
          h('td', {}, [a.tel, a.email].filter(Boolean).join(' — ')),
          h('td', {},
            h('button', { class: 'btn small', onclick: () => edit(a) }, 'Modifier'), ' ',
            h('button', { class: 'btn small danger', onclick: async () => {
              if (await confirmDialog({ title: 'Supprimer cet agent ?', danger: true, confirmLabel: 'Supprimer' })) { await store.delAgent(a.id); toast('Agent supprimé.', 'ok'); render(ctx); }
            } }, 'Supprimer'))))))));
  }

  function edit(a) {
    const isNew = !a;
    const d = a || { role: 'controle', nom: '', prenom: '', fonction: '', societe: '', tel: '', email: '' };
    const backdrop = h('div', { class: 'modal-backdrop' });
    const els = {
      role: h('select', {}, ['controle', 'client'].map((r) => { const o = h('option', { value: r }, r === 'client' ? 'Client (MOA)' : 'Contrôle'); if (d.role === r) o.selected = true; return o; })),
      nom: textInput(d.nom), prenom: textInput(d.prenom), fonction: textInput(d.fonction),
      societe: textInput(d.societe), tel: textInput(d.tel), email: textInput(d.email),
    };
    const modal = h('div', { class: 'modal' },
      h('h3', {}, isNew ? 'Nouvel agent' : "Modifier l’agent"),
      field('Rôle *', els.role),
      h('div', { class: 'grid2' }, field('Nom *', els.nom, { required: true }), field('Prénom', els.prenom), field('Fonction', els.fonction), field('Société', els.societe), field('Téléphone', els.tel), field('E-mail', els.email)),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', onclick: () => backdrop.remove() }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!els.nom.value.trim()) { toast('Nom obligatoire.', 'err'); return; }
          await store.putAgent({ ...d, role: els.role.value, nom: els.nom.value.trim(), prenom: els.prenom.value.trim(), fonction: els.fonction.value.trim(), societe: els.societe.value.trim(), tel: els.tel.value.trim(), email: els.email.value.trim() });
          toast('Agent enregistré.', 'ok');
          backdrop.remove();
          render(ctx);
        } }, 'Enregistrer')));
    backdrop.append(modal);
    document.getElementById('modal-root').append(backdrop);
  }
}
