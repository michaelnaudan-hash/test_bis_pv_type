/* Paramètres généraux : identité société (logo, couleurs, pied de page, contacts),
 * préfixe de numérotation, affichage des non-renseignés, avertissement stockage local. */
import * as store from '../store.js';
import { h, toast, field, textInput, textarea } from '../ui.js';
import { blobToDataURL } from '../util.js';

export async function render(ctx) {
  const s = await store.getSettings();
  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, 'Paramètres généraux'));

  const card = h('div', { class: 'card' },
    h('h2', {}, 'Identité & modèle de document'),
    h('div', { class: 'grid2' },
      field('Nom de la société', textInput(s.societe || '')),
      field('Couleur principale', h('input', { type: 'color', value: s.couleurPrimaire || '#0d47a1', style: 'min-height:44px;padding:2px' })),
      field('Contacts (adresse, tél., e-mail)', textarea(s.contact || '', { rows: 2 })),
      field('Préfixe de numérotation des PV', textInput(s.numeroPrefix || 'PV'))),
    h('label', { class: 'fld' }, h('span', {}, 'Logo (apparaîtra sur la page de garde)'),
      h('div', { class: 'row' },
        h('input', { type: 'file', accept: 'image/*', onchange: async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const dataUrl = await blobToDataURL(f);
          s.logoDataUrl = dataUrl;
          await store.putSetting('logoDataUrl', dataUrl);
          toast('Logo enregistré.', 'ok');
          render(ctx);
        } }),
        s.logoDataUrl ? h('img', { src: s.logoDataUrl, style: 'height:48px;border:1px solid var(--border);border-radius:6px' }) : null,
        s.logoDataUrl ? h('button', { class: 'btn small danger', onclick: async () => { await store.putSetting('logoDataUrl', null); render(ctx); } }, 'Retirer le logo') : null)),
    field('Pied de page des documents', textarea(s.piedPage || '', { rows: 2 })),
    h('h2', {}, 'Saisie'),
    h('label', { class: 'switch' },
      h('input', { type: 'checkbox', checked: !!s.afficherNonRenseignes, onchange: async (e) => { await store.putSetting('afficherNonRenseignes', e.target.checked); toast('Paramètre enregistré.', 'ok'); } }),
      "Afficher les contrôles non renseignés dans l’interface de travail (ils restent masqués du document final)"),
    h('div', { class: 'alert warn', style: 'margin-top:14px' },
      h('b', {}, 'Stockage local : '), 'toutes les données (dossiers, photos, référentiel, paramètres) sont enregistrées uniquement sur cet appareil (IndexedDB). Aucune donnée n est transmise vers un serveur. Effectuez des sauvegardes régulières et exportez vos dossiers (.pvpack) pour les transférer vers un autre appareil — voir le menu 💾 Sauvegarde & restauration.'));

  card.querySelectorAll('input[type="text"], textarea').forEach((inp) => {
    inp.addEventListener('input', async () => {
      const map = {};
      card.querySelectorAll('input[type="text"], textarea').forEach(() => {});
      await store.putSettings({
        societe: card.querySelectorAll('input[type="text"]')[0].value,
        numeroPrefix: card.querySelectorAll('input[type="text"]')[1].value,
        contact: card.querySelectorAll('textarea')[0].value,
        piedPage: card.querySelectorAll('textarea')[1].value,
      });
    });
  });
  const colorInput = card.querySelector('input[type="color"]');
  colorInput.addEventListener('input', async () => { await store.putSetting('couleurPrimaire', colorInput.value); });

  ctx.view.append(card);
}
