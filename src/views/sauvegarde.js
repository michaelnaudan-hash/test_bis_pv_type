/* Sauvegarde & restauration : export/import d’un dossier (.pvpack) ou de la totalité
 * des données, chiffrement optionnel (AES-GCM via WebCrypto), contrôle d’intégrité SHA-256,
 * transfert d’un appareil à un autre. */
import * as store from '../store.js';
import { h, toast, confirmDialog, field, textInput, select } from '../ui.js';
import { downloadBlob, blobToArrayBuffer } from '../util.js';
import { listPVs } from '../store.js';

export async function render(ctx) {
  const pvs = await listPVs();
  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, 'Sauvegarde & restauration'));

  ctx.view.append(h('div', { class: 'alert warn' },
    h('b', {}, 'Vos données vivent uniquement sur cet appareil. '),
    "Exportez régulièrement vos dossiers (.pvpack) et/ou une sauvegarde globale. Le transfert d’un dossier d’un appareil à un autre se fait en exportant l’archive sur le premier, puis en l’important sur le second."));

  // Export dossier
  const pvSel = select(pvs.map((p) => ({ value: p.id, label: `${p.numero} — ${p.intitule || p.ouvrage || ''}` })), pvs[0]?.id || '');
  const pass1 = textInput('', { type: 'password', placeholder: 'Optionnel' });
  ctx.view.append(h('div', { class: 'card' },
    h('h2', {}, 'Exporter un dossier (données + photos + référentiel figé)'),
    h('div', { class: 'grid2' },
      field('Dossier', pvSel),
      field('Mot de passe de chiffrement (optionnel, AES-256-GCM)', pass1)),
    h('button', { class: 'btn primary', onclick: async () => {
      if (!pvSel.value) return toast('Sélectionnez un dossier.', 'err');
      try {
        const u8 = await store.exportDossier(pvSel.value, { passphrase: pass1.value });
        const pv = await store.getPV(pvSel.value);
        downloadBlob(new Blob([u8], { type: 'application/zip' }), `${(pv.numero || 'pv').replace(/[^a-zA-Z0-9_-]+/g, '_')}_sauvegarde.pvpack`);
        toast('Archive .pvpack exportée (empreinte SHA-256 incluse' + (pass1.value ? ', chiffrée' : '') + ').', 'ok');
      } catch (e) { toast('Erreur : ' + e.message, 'err'); }
    } }, '💾 Exporter le dossier (.pvpack)')));

  // Export global
  const pass2 = textInput('', { type: 'password', placeholder: 'Optionnel' });
  ctx.view.append(h('div', { class: 'card' },
    h('h2', {}, 'Sauvegarde globale (tous les dossiers, photos, agents, référentiel, paramètres)'),
    field('Mot de passe de chiffrement (optionnel)', pass2),
    h('button', { class: 'btn primary', onclick: async () => {
      try {
        const u8 = await store.exportGlobal({ passphrase: pass2.value });
        downloadBlob(new Blob([u8], { type: 'application/zip' }), `pv-etancheite_sauvegarde-globale_${new Date().toISOString().slice(0, 10)}.pvpack`);
        toast('Sauvegarde globale exportée.', 'ok');
      } catch (e) { toast('Erreur : ' + e.message, 'err'); }
    } }, '💾 Exporter la sauvegarde globale (.pvpack)')));

  // Import
  const pass3 = textInput('', { type: 'password', placeholder: 'Si l archive est chiffrée' });
  const fileInput = h('input', { type: 'file', accept: '.pvpack,.zip,application/zip' });
  ctx.view.append(h('div', { class: 'card' },
    h('h2', {}, 'Restaurer / transférer (importer une archive .pvpack)'),
    h('p', { class: 'hint' }, "L’intégrité de l’archive est vérifiée (empreinte SHA-256) avant import. Si un dossier de même numéro existe déjà, vous pourrez choisir de le remplacer ou de conserver les deux."),
    field('Archive .pvpack', fileInput),
    field('Mot de passe (si chiffrée)', pass3),
    h('button', { class: 'btn primary', onclick: async () => {
      const f = fileInput.files?.[0];
      if (!f) return toast('Choisissez une archive .pvpack.', 'err');
      try {
        const u8 = new Uint8Array(await blobToArrayBuffer(f));
        const rapport = await store.importArchive(u8, { passphrase: pass3.value, mode: 'fusion' });
        if (rapport.doublon) {
          const remplacer = await confirmDialog({
            title: 'Dossier déjà présent',
            body: `Un dossier portant le numéro <b>${rapport.numero}</b> existe déjà sur cet appareil. Le remplacer par celui de l’archive, ou conserver les deux (le nouveau recevra un nouveau numéro) ?`,
            confirmLabel: 'Remplacer l existant',
          });
          if (remplacer) {
            await store.deletePV(rapport.existingId);
            await store.importArchive(u8, { passphrase: pass3.value, mode: 'remplacer' });
            toast('Dossier restauré (remplacement).', 'ok');
          } else {
            toast('Dossier importé avec un nouveau numéro (les deux conservés).', 'ok');
          }
        } else if (rapport.kind === 'dossier') {
          toast(`Dossier ${rapport.numero} restauré (${rapport.photos} photo(s)).`, 'ok');
          location.hash = '#/dossiers';
        } else {
          toast(`Sauvegarde globale restaurée : ${rapport.pvs} dossier(s), ${rapport.photos} photo(s).`, 'ok');
          location.hash = '#/dashboard';
        }
      } catch (e) { toast('Import impossible : ' + e.message, 'err'); }
    } }, '📥 Importer / restaurer')));

  ctx.view.append(h('div', { class: 'card' },
    h('h2', {}, 'Format d archive (documenté)'),
    h('pre', { class: 'mono', style: 'background:#f4f6fa;padding:10px;border-radius:8px;overflow:auto;font-size:0.78rem' },
`fichier .pvpack = archive ZIP contenant :
  manifest.json   { format:"pv-etancheite-backup", version, kind:"dossier"|"global",
                    appVersion, exportDate, encrypted, photos:[{id,file,encrypted}] }
  dossier.json[.enc]  (kind=dossier) dossier PV complet : infos, interventions,
                      résultats, photos (métadonnées), refOverrides, référentiel figé (snapshot)
  data.json[.enc]     (kind=global)  toutes les données : settings, meta, agents, procedures,
                      referentiel, refHistory, pvs
  photos/<id>.jpg[.enc]  photographies (JPEG compressés, stockées localement)
  meta.json       { checksum: SHA-256 du fichier de données, dossierFile / dataFile }

  .enc = contenu chiffré AES-256-GCM (PBKDF2-SHA-256, 150 000 itérations, sel+IV en tête).
  L intégrité est vérifiée à l import (SHA-256) avant toute restauration.`)));
}
