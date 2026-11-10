/* Test de bout en bout headless : jsdom + fake-indexeddb.
 * Valide le flux complet : référentiel, création PV, interventions, résultats, photo,
 * sauvegarde chiffrée + restauration (intégrité SHA-256), exports PDF/DOCX/ODT.
 * Exécution : node tests/e2e.test.mjs   (nécessite jsdom et fake-indexeddb, voir package.json devDependencies) */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire('/tmp/nettest/package.json');
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

// ---------- environnement navigateur simulé ----------
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/pv-etancheite/', pretendToBeVisual: true, runScripts: 'outside-only' });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'FormData', 'CustomEvent', 'Event', 'Node', 'Image', 'URL', 'MutationObserver']) {
  if (w[k] !== undefined) globalThis[k] = w[k];
}
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
globalThis.window = w;
globalThis.document = w.document;
globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
Object.defineProperty(globalThis, 'crypto', { value: (await import('node:crypto')).webcrypto, configurable: true });
globalThis.fetch = async (url) => {
  const p = resolve(root, String(url).replace(/^https?:\/\/localhost\/pv-etancheite\//, '').replace(/^\//, ''));
  const data = readFileSync(p);
  return { ok: true, status: 200, json: async () => JSON.parse(data.toString()), arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), headers: new Map(), clone() { return this; } };
};
w.fetch = globalThis.fetch;
// charge les libs vendored dans le contexte jsdom (comme des <script>)
w.eval(readFileSync(join(root, 'vendor/fflate.umd.js'), 'utf8'));
w.eval(readFileSync(join(root, 'vendor/jspdf.umd.min.js'), 'utf8'));
w.eval(readFileSync(join(root, 'vendor/jspdf.plugin.autotable.min.js'), 'utf8'));
globalThis.fflate = w.fflate;
globalThis.jspdf = w.jspdf;
if (!w.jspdf?.jsPDF?.API?.autoTable) throw new Error('autoTable non chargé');

let passed = 0, failed = 0;
const t = (n, c, d = '') => { if (c) { passed++; console.log(`  OK  ${n}`); } else { failed++; console.log(`  ÉCHEC  ${n} ${d}`); } };

// ---------- scénario ----------
const store = await import(join(root, 'src/store.js'));
const { buildDocModel } = await import(join(root, 'src/docmodel.js'));
const { exportPDF } = await import(join(root, 'src/export/pdf.js'));
const { exportDOCX } = await import(join(root, 'src/export/docx.js'));
const { exportODT } = await import(join(root, 'src/export/odt.js'));
const model = await import(join(root, 'src/model.js'));

console.log('== E2E : flux métier complet ==');

const ref = await store.getReferentiel();
t('référentiel chargé (58 points)', ref.controles.length === 58);

// agents
await store.putAgent({ id: 'a1', role: 'controle', nom: 'Dupont', prenom: 'Jean', fonction: 'Contrôleur', societe: 'Bureau C' });
await store.putAgent({ id: 'a2', role: 'client', nom: 'Martin', prenom: 'Claire', fonction: 'MOA', societe: 'CD 01' });
t('agents enregistrés', (await store.listAgents()).length === 2);

// création PV béton / FPM
const pv = await store.createPV({ intitule: 'E2E — pont test', ouvrage: 'Pont E2E', localisation: 'RN1', support: 'beton', familleId: 'FPM' });
t('PV créé avec n° auto', !!pv.numero, pv.numero);
t('snapshot figé du référentiel', pv.referentielSnapshot.controles.length === 58);

const beton = model.controlesApplicables(ref.controles, pv);
t('périmètre béton filtré', beton.length > 0 && beton.every((c) => c.support !== 'acier'));

// interventions multiples
await store.addIntervention(pv.id, { date: '2025-04-01', heure: '09:00', description: 'Réception support', agentIds: ['a1'], clientIds: ['a2'] });
await store.addIntervention(pv.id, { date: '2025-04-03', description: 'Pose feuilles' });
let p = await store.getPV(pv.id);
t('2 interventions enregistrées', p.interventions.length === 2);

// résultats + conformité auto
const c1 = beton.find((c) => c.id === 'CTL-SUP-01');
await store.saveControl({ ...c1, mesure: { type: 'max', max: 8, unite: 'mm' } });
const ref2 = await store.getReferentiel();
const c1m = ref2.controles.find((c) => c.id === c1.id);
t('critère quantifié paramétrable', model.evaluerConformite(c1m, 4) === 'conforme' && model.evaluerConformite(c1m, 12) === 'non_conforme');
await store.setResultat(pv.id, 'CTL-SUP-01', { statut: 'conforme', mesure: 4, unite: 'mm', commentaire: '4 mm sous règle 2 m', agentIds: ['a1'], interventionId: p.interventions[0].id });
await store.setResultat(pv.id, 'CTL-SUP-05', { statut: 'conforme', mesure: 3.1, unite: '%' });
await store.setResultat(pv.id, 'CTL-FEU-02', { statut: 'non_conforme', commentaire: 'Bourrelet irrégulier zone PK 12' });
await store.setResultat(pv.id, 'CTL-REC-03', { statut: 'en_attente' });
p = await store.getPV(pv.id);
t('4 résultats enregistrés', Object.keys(p.resultats).length === 4);

// photo (blob JPEG 1x1 réel) rattachée à un contrôle
const JPEG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EALAQAAEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AP/EAL8QAAICAQMCAwEBAQAAAAAAAAECAxEEIRIxQQUTUWFxBiKBkTKhwfHw/9oACAEDAQE/Af/EAL8QAAIBAwMCBAMFBQQEAAAAAAABAgMEEQUSITFBUWFxEyKBkTKhwfHw4f/aAAwDAQACEQMRAD8AmgA//9k=';
const jpegBytes = Uint8Array.from(Buffer.from(JPEG_B64, 'base64'));
const db = await import(join(root, 'src/db.js'));
await db.put('photos', 'blobtest', { key: 'blobtest', blob: new Blob([jpegBytes], { type: 'image/jpeg' }), type: 'image/jpeg', size: jpegBytes.length, width: 1, height: 1, creeLe: new Date().toISOString() });
p.photos.push({ id: 'ph1', blobKey: 'blobtest', legende: 'Photo test E2E', controlId: 'CTL-SUP-01', phaseId: 'PH-01', interventionId: p.interventions[0].id, ordre: 1, creeLe: new Date().toISOString() });
await store.savePV(p);
p = await store.getPV(pv.id);
t('photo rattachée à un contrôle', p.photos.length === 1 && p.photos[0].controlId === 'CTL-SUP-01');
t('pas d alerte de cohérence photo', model.coherencePV(p, store.refEffectifPV(p)).every((m) => !m.includes('rattach')));

// modèle de document
const settings = await store.getSettings();
const refEff = store.refEffectifPV(p);
const doc = buildDocModel(p, refEff, settings, await store.listAgents(), {});
t('doc : 4 fiches de contrôle (renseignés seuls)', doc.blocks.filter((b) => b.t === 'ctrl').length === 4);
t('doc : bloc photo présent', doc.blocks.some((b) => b.t === 'img' && b.num === 1));
t('doc : conclusion défavorable (NC présent)', doc.blocks.find((b) => b.t === 'conclusion').avis === 'défavorable');

// exports PDF / DOCX / ODT
let pdfBytes = null;
const origSave = w.jspdf.jsPDF.API.save;
w.jspdf.jsPDF.API.save = function () { pdfBytes = new Uint8Array(this.output('arraybuffer')); };
const captured = [];
const origCreate = w.document.createElement.bind(w.document);
w.document.createElement = (tag) => {
  const e = origCreate(tag);
  if (tag === 'a') { const oc = e.click.bind(e); e.click = () => { captured.push({ href: e.href, name: e.download }); }; }
  return e;
};
const urlMap = new Map();
const origCreateURL = w.URL.createObjectURL?.bind(w.URL);
w.URL.createObjectURL = (b) => { const u = 'blob:e2e-' + urlMap.size; urlMap.set(u, b); return u; };

try { await exportPDF(doc, p, 'e2e.pdf'); }
catch (e) { console.log('ERREUR exportPDF:', e.message); console.log(e.stack.split('\n').slice(0,4).join('\n')); throw e; }
t('PDF généré', pdfBytes && pdfBytes.length > 1000 && Buffer.from(pdfBytes.slice(0, 5)).toString() === '%PDF-');
if (pdfBytes) writeFileSync('/tmp/e2e.pdf', pdfBytes);

await exportDOCX(doc, p, 'e2e.docx');
await exportODT(doc, p, 'e2e.odt');
const docxCap = captured.find((c) => c.name === 'e2e.docx');
const odtCap = captured.find((c) => c.name === 'e2e.odt');
t('DOCX généré', !!docxCap);
t('ODT généré', !!odtCap);
const docxU8 = new Uint8Array(await urlMap.get(docxCap.href).arrayBuffer());
const odtU8 = new Uint8Array(await urlMap.get(odtCap.href).arrayBuffer());
writeFileSync('/tmp/e2e.docx', docxU8);
writeFileSync('/tmp/e2e.odt', odtU8);
const dz = w.fflate.unzipSync(docxU8);
const oz = w.fflate.unzipSync(odtU8);
t('DOCX : photo embarquée', Object.keys(dz).some((k) => k.startsWith('word/media/')));
t('ODT : photo embarquée', Object.keys(oz).some((k) => k.startsWith('Pictures/')));
t('DOCX : photo référencée dans document.xml', new TextDecoder().decode(dz['word/document.xml']).includes('r:embed'));
t('ODT : image référencée dans content.xml', new TextDecoder().decode(oz['content.xml']).includes('Pictures/'));
w.jspdf.jsPDF.API.save = origSave;

// sauvegarde chiffrée + restauration
const u8 = await store.exportDossier(pv.id, { passphrase: 'secret-test' });
const rapport = await store.importArchive(u8, { passphrase: 'secret-test', mode: 'remplacer' });
t('archive chiffrée exportée puis restaurée', rapport.kind === 'dossier' && rapport.photos === 1);
let refuse = false;
try { await store.importArchive(u8, { passphrase: 'mauvais', mode: 'remplacer' }); } catch (e) { refuse = true; }
t('mauvais mot de passe → import refusé', refuse);
const restaure = (await store.listPVs()).find((x) => x.id === pv.id || x.numero === pv.numero);
t('données conservées après réouverture (IndexedDB)', !!restaure && Object.keys(restaure.resultats).length === 4 && restaure.photos.length === 1);

// suppression du référentiel : le PV garde son snapshot
const c1id = 'CTL-SUP-01';
await store.deleteControl(c1id);
const refApres = await store.getReferentiel();
const pApres = await store.getPV(pv.id);
t('suppression référentiel sans toucher au PV', !refApres.controles.some((c) => c.id === c1id) && pApres.referentielSnapshot.controles.some((c) => c.id === c1id));
t('historique des modifications enregistré', (await store.getRefHistory()).length > 0);

console.log(`\n${passed} réussis, ${failed} échoués — artefacts: /tmp/e2e.pdf /tmp/e2e.docx /tmp/e2e.odt`);
process.exit(failed ? 1 : 0);
