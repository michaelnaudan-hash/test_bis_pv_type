/* Page de tests de recette automatisés (exécutables dans le navigateur, hors connexion).
 * Couvre les tests du cahier des charges : création PV, filtrage support, procédé,
 * masquage, multi-interventions, export PDF/DOCX/ODT, sauvegarde/restauration, cohérence. */
import * as store from '../store.js';
import { h, toast } from '../ui.js';
import { controlesApplicables, evaluerConformite, conclusionAuto, coherencePV } from '../model.js';
import { buildDocModel } from '../docmodel.js';
import { blobToArrayBuffer } from '../util.js';

export async function render(ctx) {
  ctx.view.append(h('h1', { style: 'color:var(--primary-dark)' }, 'Tests de recette automatisés'));
  const out = h('div', {});
  ctx.view.append(out);
  const results = [];
  const log = (n, ok, detail) => {
    results.push({ n, ok, detail });
    out.append(h('div', { class: 'card', style: 'padding:8px 12px' },
      h('span', { class: `chip ${ok ? 'conforme' : 'non_conforme'}` }, ok ? 'OK' : 'ÉCHEC'), ' ',
      h('b', {}, `Test ${n} — `), h('span', {}, detail || '')));
  };

  const run = h('button', { class: 'btn primary big', onclick: async () => {
    out.innerHTML = ''; results.length = 0;
    try {
      const ref = await store.getReferentiel();

      // 1. Création d’un PV
      const pv = await store.createPV({ intitule: 'TEST recette', ouvrage: 'Ouvrage test', support: 'beton', familleId: 'FPM' });
      log(1, !!pv.id && !!pv.numero, `PV créé : ${pv.numero}`);

      // 2/3. Filtrage support béton / acier
      const beton = controlesApplicables(ref.controles, { support: 'beton', familleId: pv.familleId });
      const acier = controlesApplicables(ref.controles, { support: 'acier', familleId: pv.familleId });
      const ok2 = beton.every((c) => c.support !== 'acier') && beton.some((c) => c.support === 'beton');
      const ok3 = acier.every((c) => c.support !== 'beton') && acier.some((c) => c.support === 'acier');
      log(2, ok2, `${beton.length} contrôles pour béton (aucun spécifique acier)`);
      log(3, ok3, `${acier.length} contrôles pour acier (aucun spécifique béton)`);

      // 4. Procédé → référentiel correspondant
      const sel = controlesApplicables(ref.controles, { support: 'beton', familleId: 'SEL' });
      log(4, sel.length < beton.length && sel.some((c) => c.famille === 'SEL'), `${sel.length} contrôles pour SEL (sous-ensemble + spécifiques SEL)`);

      // 5. Modification d’un critère enregistrée
      const c0 = ref.controles[0];
      await store.saveControl({ ...c0, exigence: c0.exigence + ' [modifié test]' });
      const ref2 = await store.getReferentiel();
      log(5, ref2.controles.find((c) => c.id === c0.id).exigence.includes('[modifié test]'), 'Critère modifié et relu depuis le stockage local');
      await store.saveControl({ ...c0 }, 'modification'); // restauration

      // 6. Justification documentaire
      await store.saveControl({ ...c0, refs: [{ typeDoc: 'CCTP', reference: 'CCTP lot 3 §5.2', version: 'A', dateDoc: '2024-01-15', page: '12', article: '§5.2', extrait: 'Exigence exemple', commentaire: '' }] });
      const ref3 = await store.getReferentiel();
      log(6, ref3.controles.find((c) => c.id === c0.id).refs?.length === 1, 'Référence contractuelle associée au critère');
      await store.saveControl({ ...c0 }, 'modification');

      // 7/8. Ajout / suppression de point sans altération des anciens PV
      const snapAvant = pv.referentielSnapshot.controles.length;
      await store.saveControl({ id: 'CTL-TEST-99', code: 'CTL-TEST-99', phaseId: ref.phases[0].id, intitule: 'Test', type: 'PC', support: 'commun', famille: 'toutes', exigence: 'x', methode: '', frequence: '', acteurs: '', source: '', obligatoire: true, mesure: null, refs: [], actif: true, ordre: 999 }, 'ajout');
      const ref4 = await store.getReferentiel();
      const pv2 = await store.getPV(pv.id);
      log(7, ref4.controles.some((c) => c.id === 'CTL-TEST-99'), 'Point ajouté disponible dans le référentiel');
      await store.deleteControl('CTL-TEST-99');
      const ref5 = await store.getReferentiel();
      const pv3 = await store.getPV(pv.id);
      log(8, !ref5.controles.some((c) => c.id === 'CTL-TEST-99') && pv3.referentielSnapshot.controles.length === snapAvant, 'Suppression du référentiel sans altération du snapshot du PV');

      // 9. Plusieurs interventions
      await store.addIntervention(pv.id, { date: '2025-01-10', description: 'J1' });
      await store.addIntervention(pv.id, { date: '2025-01-11', description: 'J2' });
      const pvI = await store.getPV(pv.id);
      log(9, pvI.interventions.length === 2, '2 dates d intervention dans le même PV');

      // 10. Masquage des non renseignés + 7.2 conformité auto
      await store.setResultat(pv.id, beton[0].id, { statut: 'conforme', mesure: 2 });
      await store.setResultat(pv.id, beton[1].id, { statut: 'non_applicable' });
      const model = buildDocModel(pvI, store.refEffectifPV(pvI), await store.getSettings(), []);
      const ctrlBlocks = model.blocks.filter((b) => b.t === 'ctrl');
      const hasNA = ctrlBlocks.some((b) => b.rows.some(([k, v]) => v && v.chip === 'non_applicable'));
      log(10, ctrlBlocks.length === 2 && hasNA, `Document ne contient que les 2 contrôles renseignés (dont N/A explicite)`);

      // conformité auto
      const q = { mesure: { type: 'max', max: 8, unite: 'mm' } };
      log('7.2a', evaluerConformite(q, 4) === 'conforme' && evaluerConformite(q, 12) === 'non_conforme', 'Évaluation auto max=8 mm : 4→conforme, 12→non conforme');
      log('7.2b', evaluerConformite({ mesure: null }, 4) === null && evaluerConformite(q, '') === null, 'Jamais de conformité auto sans critère/mesure');

      // conclusion
      await store.setResultat(pv.id, beton[2].id, { statut: 'non_conforme' });
      const pvC = await store.getPV(pv.id);
      const conc = conclusionAuto(pvC, ref);
      log('10.3', conc.avis === 'défavorable' && !/FAVORABLE/.test(conc.texte), 'Conclusion : jamais conforme globale avec NC présente');

      // cohérence
      await store.addPhoto(pv.id, { file: new File([new Uint8Array([1, 2, 3])], 'x.jpg', { type: 'image/jpeg' }), legende: 'test' });
      const pvP = await store.getPV(pv.id);
      log('18a', coherencePV(pvP, ref).some((m) => m.includes('rattachement')), 'Photo non rattachée signalée par le contrôle de cohérence');
      await store.deletePhoto(pv.id, pvP.photos[0].id);

      // 16/17/18. Exports
      const settings = await store.getSettings();
      const agents = await store.listAgents();
      const modelFull = buildDocModel(pvC, store.refEffectifPV(pvC), settings, agents);
      try {
        const { exportPDF } = await import('../export/pdf.js');
        let saved = null;
        const origSave = window.jspdf.jsPDF.API.save;
        window.jspdf.jsPDF.API.save = function (name) { saved = name; };
        await exportPDF(modelFull, pvC, 'test.pdf');
        window.jspdf.jsPDF.API.save = origSave;
        log(16, !!saved, 'PDF généré (jsPDF local)');
      } catch (e) { log(16, false, e.message); }
      try {
        const { exportDOCX } = await import('../export/docx.js');
        const a = document.createElement('a'); let clicked = false;
        const origClick = a.click.bind(a);
        // intercepter le téléchargement
        const origCreate = document.createElement.bind(document);
        document.createElement = (tag) => { const e = origCreate(tag); if (tag === 'a') { const oc = e.click.bind(e); e.click = () => { clicked = true; }; } return e; };
        await exportDOCX(modelFull, pvC, 'test.docx');
        document.createElement = origCreate;
        log(17, clicked, 'DOCX généré (zip OOXML local)');
      } catch (e) { log(17, false, e.message); }
      try {
        const { exportODT } = await import('../export/odt.js');
        const origCreate = document.createElement.bind(document);
        let clicked = false;
        document.createElement = (tag) => { const e = origCreate(tag); if (tag === 'a') { e.click = () => { clicked = true; }; } return e; };
        await exportODT(modelFull, pvC, 'test.odt');
        document.createElement = origCreate;
        log(18, clicked, 'ODT généré (zip ODF local)');
      } catch (e) { log(18, false, e.message); }

      // 21. Sauvegarde / restauration
      try {
        await store.addPhoto(pv.id, { file: new File([new Uint8Array([9, 9, 9])], 'y.jpg', { type: 'image/jpeg' }), legende: 'sauvegarde', controlId: beton[0].id, phaseId: beton[0].phaseId });
        const u8 = await store.exportDossier(pv.id, { passphrase: 'test' });
        const rapport = await store.importArchive(u8, { passphrase: 'test', mode: 'remplacer' });
        log(21, rapport.kind === 'dossier' && rapport.photos >= 1, `Archive chiffrée exportée/importée (${rapport.photos} photo(s)), intégrité SHA-256 vérifiée`);
        let bad = false;
        try { await store.importArchive(u8, { passphrase: 'mauvais', mode: 'remplacer' }); } catch (e) { bad = true; }
        log('21b', bad, 'Mauvais mot de passe → import refusé (intégrité)');
      } catch (e) { log(21, false, e.message); }

      // 19. Persistance (relecture après "fermeture")
      const pvR = await store.getPV(pv.id);
      log(19, pvR.resultats && Object.keys(pvR.resultats).length >= 3 && pvR.interventions.length === 2, 'Toutes les données relues depuis IndexedDB');

      // nettoyage
      await store.deletePV(pv.id);
      const nbOk = results.filter((r) => r.ok).length;
      out.prepend(h('div', { class: `alert ${nbOk === results.length ? 'info' : 'err'}` },
        h('b', {}, `${nbOk}/${results.length} tests réussis.`)));
    } catch (e) {
      console.error(e);
      log('!', false, 'Erreur inattendue : ' + (e.message || e));
    }
  } }, '▶ Lancer les tests de recette');
  ctx.view.prepend(run);
}
