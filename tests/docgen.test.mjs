/* Test Node des générateurs de documents : construit un modèle de document à partir d'un PV
 * fictif (sans photos) et produit DOCX / ODT / PDF, puis vérifie la structure des archives.
 * Exécution : node tests/docgen.test.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

// --- stubs navigateur minimaux ---
const blobs = new Map();
let blobSeq = 0;
globalThis.URL.createObjectURL = (b) => { const u = `blob:fake-${blobSeq++}`; blobs.set(u, b); return u; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement: (tag) => {
    if (tag === 'a') return { set href(v) { this._href = v; }, get href() { return this._href; }, download: '', click() { captured.push({ href: this._href, download: this.download }); }, remove() {} };
    return {};
  },
  body: { appendChild() {} },
};
const captured = [];
globalThis.window = globalThis;
// charge le bundle UMD fflate comme un script navigateur (évite les soucis de type:module)
{
  const src = readFileSync(join(root, 'vendor/fflate.umd.js'), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'self', 'window', src)(mod, mod.exports, globalThis, globalThis);
  globalThis.fflate = mod.exports;
}

const { buildDocModel } = await import(join(root, 'src/docmodel.js'));
const { exportDOCX } = await import(join(root, 'src/export/docx.js'));
const { exportODT } = await import(join(root, 'src/export/odt.js'));

const ref = JSON.parse(readFileSync(join(root, 'data/referentiel.json'), 'utf8'));
const pv = {
  id: 'test', numero: 'PV-TEST-001', intitule: 'Opération test', ouvrage: 'Pont test', localisation: 'Testville',
  maitreOuvrage: 'MOA test', maitreOeuvre: 'MOE test', entreprise: 'ENT test', entrepriseEtancheite: 'ETA test',
  lot: 'Lot 1', natureTravaux: 'Etanchéité', familleId: 'FPM', support: 'beton', procedeNom: 'FPM test',
  fabricant: 'Fab', referenceSysteme: 'REF', refsDocTechniques: 'CCTP', meteo: 'soleil', observations: 'obs',
  interventions: [{ id: 'i1', date: '2025-03-10', heure: '09:00', description: 'J1', agentIds: [], clientIds: [], observations: 'RAS' }],
  resultats: {
    'CTL-SUP-01': { statut: 'conforme', mesure: 4, unite: 'mm', commentaire: 'OK', agentIds: [], interventionId: 'i1' },
    'CTL-SUP-02': { statut: 'non_conforme', commentaire: 'Bullage excessif' },
    'CTL-SUP-05': { statut: 'non_applicable' },
    'CTL-FEU-01': { statut: 'conforme_reserves', commentaire: 'réserve' },
  },
  photos: [], refOverrides: {}, conclusion: '', synthese: 'Synthèse test',
  referentielSnapshot: ref,
};
const settings = { societe: 'Ma Société Test', couleurPrimaire: '#0d47a1', piedPage: 'Pied test', logoDataUrl: null };
const model = buildDocModel(pv, ref, settings, [], {});

let failed = 0;
const t = (n, c, d = '') => { console.log(`  ${c ? 'OK' : 'ÉCHEC'}  ${n} ${d}`); if (!c) failed++; };

t('modèle : page de garde', model.blocks[0].t === 'cover');
t('modèle : sections numérotées', model.blocks.filter((b) => b.t === 'h1').length >= 5);
t('modèle : seuls les contrôles renseignés (4)', model.blocks.filter((b) => b.t === 'ctrl').length === 4,
  `obtenu ${model.blocks.filter((b) => b.t === 'ctrl').length}`);
t('modèle : N/A explicite conservé', model.blocks.some((b) => b.t === 'ctrl' && b.rows.some(([, v]) => v && v.chip === 'non_applicable')));
t('modèle : puce non conforme', model.blocks.some((b) => b.t === 'ctrl' && b.rows.some(([, v]) => v && v.chip === 'non_conforme')));
t('modèle : conclusion', model.blocks.some((b) => b.t === 'conclusion' && b.avis === 'défavorable'));
t('modèle : signatures', model.blocks.filter((b) => b.t === 'sig').length === 2);

await exportDOCX(model, pv, 'test.docx');
await exportODT(model, pv, 'test.odt');
t('DOCX téléchargé', captured.some((c) => c.download === 'test.docx'));
t('ODT téléchargé', captured.some((c) => c.download === 'test.odt'));

const docxCap = captured.find((c) => c.download === 'test.docx');
const odtCap = captured.find((c) => c.download === 'test.odt');
const docxU8 = new Uint8Array(await blobs.get(docxCap.href).arrayBuffer());
const odtU8 = new Uint8Array(await blobs.get(odtCap.href).arrayBuffer());
writeFileSync('/tmp/test.docx', docxU8);
writeFileSync('/tmp/test.odt', odtU8);

const dz = fflate.unzipSync(docxU8);
t('DOCX : [Content_Types].xml', !!dz['[Content_Types].xml']);
t('DOCX : document.xml', !!dz['word/document.xml']);
t('DOCX : styles/header/footer', !!dz['word/styles.xml'] && !!dz['word/header1.xml'] && !!dz['word/footer1.xml']);
t('DOCX : rels', !!dz['word/_rels/document.xml.rels'] && !!dz['_rels/.rels']);
const docXml = new TextDecoder().decode(dz['word/document.xml']);
t('DOCX : contient le n° PV', docXml.includes('PV-TEST-001'));
t('DOCX : contient un tableau', docXml.includes('<w:tbl>'));
t('DOCX : contient le statut Non conforme', docXml.includes('Non conforme'));
t('DOCX : cantSplit (lignes non coupées)', docXml.includes('cantSplit'));
t('DOCX : sectPr A4 + header/footer', docXml.includes('headerReference') && docXml.includes('w:w="11907"'));

const oz = fflate.unzipSync(odtU8);
t('ODT : mimetype', new TextDecoder().decode(oz['mimetype']) === 'application/vnd.oasis.opendocument.text');
t('ODT : content/styles/manifest/meta', !!oz['content.xml'] && !!oz['styles.xml'] && !!oz['META-INF/manifest.xml'] && !!oz['meta.xml']);
const oc = new TextDecoder().decode(oz['content.xml']);
t('ODT : contient le n° PV', oc.includes('PV-TEST-001'));
t('ODT : tableaux + titres', oc.includes('<table:table') && oc.includes('<text:h'));
t('ODT : keep-together sur les lignes', new TextDecoder().decode(oz['styles.xml']).includes('keep-together'));
const os = new TextDecoder().decode(oz['styles.xml']);
t('ODT : master-page avec en-tête/pied + n° page', os.includes('master-page') && os.includes('text:page-number'));

console.log(failed ? `\n${failed} ÉCHEC(S)` : '\nTous les tests documentaires passent. Fichiers écrits : /tmp/test.docx, /tmp/test.odt');
process.exit(failed ? 1 : 0);
