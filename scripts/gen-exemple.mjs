/* Génère un modèle de PV exemple (PDF/DOCX/ODT) dans docs/exemples/ via le pipeline réel.
 * Données fictives clairement identifiées comme exemple. Exécution : node scripts/gen-exemple.mjs */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire('/tmp/nettest/package.json');
const { IDBFactory, IDBKeyRange } = req('fake-indexeddb');
globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const blobs = new Map();
let seq = 0;
globalThis.URL.createObjectURL = (b) => { const u = `blob:x-${seq++}`; blobs.set(u, b); return u; };
globalThis.URL.revokeObjectURL = () => {};
const captured = [];
globalThis.document = {
  createElement: (tag) => tag === 'a'
    ? { set href(v) { this._h = v; }, get href() { return this._h; }, download: '', click() { captured.push({ href: this._h, name: this.download }); }, remove() {} }
    : {},
  body: { appendChild() {} },
};
globalThis.window = globalThis;
{
  const src = readFileSync(join(root, 'vendor/fflate.umd.js'), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'self', 'window', src)(mod, mod.exports, globalThis, globalThis);
  globalThis.fflate = mod.exports;
}

// jsPDF + autotable dans un contexte jsdom (pour l'export PDF de l'exemple)
const { JSDOM } = req('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
dom.window.eval(readFileSync(join(root, 'vendor/jspdf.umd.min.js'), 'utf8'));
dom.window.eval(readFileSync(join(root, 'vendor/jspdf.plugin.autotable.min.js'), 'utf8'));
globalThis.jspdf = dom.window.jspdf;
let pdfBytes = null;
dom.window.jspdf.jsPDF.API.save = function () { pdfBytes = new Uint8Array(this.output('arraybuffer')); };

const { buildDocModel } = await import(join(root, 'src/docmodel.js'));
const { exportPDF } = await import(join(root, 'src/export/pdf.js'));
const { exportDOCX } = await import(join(root, 'src/export/docx.js'));
const { exportODT } = await import(join(root, 'src/export/odt.js'));

const ref = JSON.parse(readFileSync(join(root, 'data/referentiel.json'), 'utf8'));

// photo JPEG 1x1 (exemple)
const JPEG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EALAQAAEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AP/EAL8QAAICAQMCAwEBAQAAAAAAAAECAxEEIRIxQQUTUWFxBiKBkTKhwfHw/9oACAEDAQE/Af/EAL8QAAIBAwMCBAMFBQQEAAAAAAABAgMEEQUSITFBUWFxEyKBkTKhwfHw4f/aAAwDAQACEQMRAD8AmgA//9k=';
const jpegU8 = Uint8Array.from(Buffer.from(JPEG_B64, 'base64'));
const db = await import(join(root, 'src/db.js'));
for (const k of ['p1', 'p2', 'p3']) {
  await db.put('photos', k, { key: k, blob: new Blob([jpegU8], { type: 'image/jpeg' }), type: 'image/jpeg', width: 1600, height: 1200, size: jpegU8.length, creeLe: new Date().toISOString() });
}

const pv = {
  id: 'exemple', numero: 'PV-2025-001', demo: false,
  intitule: 'Exemple — Rénovation de l’étanchéité du tablier', ouvrage: 'Pont sur la rivière (exemple)',
  localisation: 'RD 12 — PK 3+450 (exemple)', maitreOuvrage: 'Maîtrise d’ouvrage (exemple)',
  maitreOeuvre: 'Bureau d’études (exemple)', entreprise: 'Entreprise titulaire (exemple)',
  entrepriseEtancheite: 'Étancheur (exemple)', lot: 'Lot 3 — Étanchéité',
  natureTravaux: 'Reprise du complexe d’étanchéité', familleId: 'FPM', support: 'beton',
  procedeNom: 'Feuilles bitumineuses préfabriquées (exemple)', fabricant: 'Fabricant (exemple)',
  referenceSysteme: 'Système FPM (exemple)', refsDocTechniques: 'CCTP lot 3 ; AT du procédé ; PAQ',
  meteo: 'Ciel dégagé, 18 °C', observations: 'Document d’exemple généré par l’application (données fictives).',
  interventions: [
    { id: 'i1', date: '2025-03-10', heure: '09:00', description: 'Réception du support après dépose', agentIds: ['a1'], clientIds: ['a2'], observations: 'Support sain globalement.' },
    { id: 'i2', date: '2025-03-12', heure: '08:30', description: 'Primaire + pose des feuilles', agentIds: ['a1'], clientIds: [], observations: 'Conditions favorables.' },
  ],
  resultats: {
    'CTL-SUP-01': { statut: 'conforme', mesure: 4, unite: 'mm', commentaire: 'Écart 4 mm sous règle de 2 m.', agentIds: ['a1'], interventionId: 'i1' },
    'CTL-SUP-05': { statut: 'conforme', mesure: 3.2, unite: '%', commentaire: 'Humidité 3,2 % (carbure).', agentIds: ['a1'], interventionId: 'i1' },
    'CTL-SUP-15': { statut: 'conforme', commentaire: 'Réception contradictoire du support.', agentIds: ['a1'], interventionId: 'i1' },
    'CTL-AMB-01': { statut: 'conforme', mesure: 18, unite: '°C', commentaire: '18 °C air et support.', agentIds: ['a1'], interventionId: 'i2' },
    'CTL-ACC-01': { statut: 'conforme_reserves', commentaire: 'Dosage conforme ; zone de 2 m² à redoubler (levée le lendemain).', agentIds: ['a1'], interventionId: 'i2' },
    'CTL-FEU-01': { statut: 'conforme', commentaire: 'Pose en tuile, recouvrements conformes.', agentIds: ['a1'], interventionId: 'i2' },
    'CTL-FEU-02': { statut: 'conforme', commentaire: 'Bourrelet de fusion régulier.', agentIds: ['a1'], interventionId: 'i2' },
    'CTL-REC-01': { statut: 'conforme', commentaire: 'Aucune lésion.', agentIds: ['a1'], interventionId: 'i2' },
    'CTL-REC-03': { statut: 'en_attente', commentaire: 'Essais d’adhérence en laboratoire — résultats attendus.', agentIds: ['a1'], interventionId: 'i2' },
  },
  photos: [
    { id: 'p1', blobKey: 'p1', legende: 'État du support après préparation (exemple).', controlId: 'CTL-SUP-15', phaseId: 'PH-01', interventionId: 'i1', ordre: 1 },
    { id: 'p2', blobKey: 'p2', legende: 'Application du primaire (exemple).', controlId: 'CTL-ACC-01', phaseId: 'PH-04', interventionId: 'i2', ordre: 2 },
    { id: 'p3', blobKey: 'p3', legende: 'Soudure des feuilles (exemple).', controlId: 'CTL-FEU-02', phaseId: 'PH-05', interventionId: 'i2', ordre: 3 },
  ],
  refOverrides: {}, conclusion: '', synthese: 'Exemple de synthèse manuelle.',
  referentielSnapshot: ref,
};
const agents = [
  { id: 'a1', role: 'controle', nom: 'Dupont', prenom: 'Jean', fonction: 'Contrôleur technique', societe: 'Bureau de contrôle (exemple)' },
  { id: 'a2', role: 'client', nom: 'Martin', prenom: 'Claire', fonction: 'Représentante MOA', societe: 'Maîtrise d’ouvrage (exemple)' },
];
const settings = { societe: 'Société Exemple', couleurPrimaire: '#0d47a1', piedPage: 'Document d’exemple — généré localement hors connexion.', logoDataUrl: null };

const model = buildDocModel(pv, ref, settings, agents, {});
mkdirSync(join(root, 'docs/exemples'), { recursive: true });
await exportPDF(model, pv, 'PV-exemple.pdf');
if (pdfBytes) { writeFileSync(join(root, 'docs/exemples/PV-exemple.pdf'), pdfBytes); console.log('écrit: docs/exemples/PV-exemple.pdf', pdfBytes.length, 'octets'); }
await exportDOCX(model, pv, 'PV-exemple.docx');
await exportODT(model, pv, 'PV-exemple.odt');
for (const c of captured) {
  const u8 = new Uint8Array(await blobs.get(c.href).arrayBuffer());
  writeFileSync(join(root, 'docs/exemples', c.name), u8);
  console.log('écrit:', 'docs/exemples/' + c.name, u8.length, 'octets');
}
console.log('Modèle de PV exemple généré : PDF + DOCX + ODT dans docs/exemples/.');
