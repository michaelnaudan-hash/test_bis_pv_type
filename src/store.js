/* Couche d’accès aux données : paramètres, agents, procédés, référentiel (avec historique),
 * dossiers PV (résultats, interventions, photos), sauvegarde/restauration. */
import * as db from './db.js';
import { uid, todayISO, deepClone, sha256Hex } from './util.js';
import { cloneSnapshot } from './model.js';
import { compressImageFile } from './photos.js';
import { emit } from './bus.js';

export const APP_VERSION = '1.0.0';
export const BACKUP_FORMAT = 'pv-etancheite-backup';
export const BACKUP_VERSION = 1;

let refBase = null;

export async function loadReferentielBase() {
  if (refBase) return refBase;
  const res = await fetch('data/referentiel.json');
  refBase = await res.json();
  return refBase;
}

/* Référentiel effectif = base JSON + éditions administrateur stockées dans IndexedDB. */
export async function getReferentiel() {
  const base = await loadReferentielBase();
  const edits = await db.getAll('referentiel');
  const byId = new Map(edits.map((e) => [e.id, e]));
  const phases = deepClone(base.phases);
  const controles = [];
  for (const c of base.controles) {
    const e = byId.get(c.id);
    if (e && e.deleted) continue;
    controles.push(e ? { ...c, ...e, deleted: undefined, customPhase: undefined } : deepClone(c));
    byId.delete(c.id);
  }
  for (const e of byId.values()) {
    if (e.customPhase) {
      if (e.deleted) {
        const i = phases.findIndex((p) => p.id === e.customPhase.id);
        if (i >= 0) phases.splice(i, 1);
      } else {
        const i = phases.findIndex((p) => p.id === e.customPhase.id);
        if (i >= 0) phases[i] = e.customPhase; else phases.push(e.customPhase);
      }
    } else if (!e.deleted) {
      controles.push({ ...e, deleted: undefined });
    }
  }
  controles.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  phases.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  return {
    meta: base.meta,
    familles: base.familles,
    phases,
    controles,
  };
}

export async function logRefHistory(action, controlId, detail) {
  const h = { id: uid(), date: new Date().toISOString(), action, controlId, detail: detail || null };
  await db.put('refHistory', h.id, h);
}

export async function getRefHistory() {
  const h = await db.getAll('refHistory');
  return h.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function saveControl(control, action = 'modification') {
  const prev = await db.get('referentiel', control.id);
  await db.put('referentiel', control.id, { ...control, deleted: false });
  await logRefHistory(action, control.id, { avant: prev ? { exigence: prev.exigence, mesure: prev.mesure, methode: prev.methode, frequence: prev.frequence } : null, apres: { exigence: control.exigence, mesure: control.mesure, methode: control.methode, frequence: control.frequence } });
}

export async function deleteControl(id) {
  const prev = await db.get('referentiel', id);
  await db.put('referentiel', id, { ...(prev || { id }), deleted: true });
  await logRefHistory('suppression', id, { avant: prev ? { intitule: prev.intitule } : null });
}

export async function restoreReferentielDefaults() {
  await db.clearStore('referentiel');
  await db.clearStore('refHistory');
  await logRefHistory('restauration', null, { detail: 'Référentiel remis aux valeurs initiales livrées.' });
  return getReferentiel();
}

/* ---------------- paramètres ---------------- */
const DEFAULT_SETTINGS = {
  societe: '', logoDataUrl: null, couleurPrimaire: '#0d47a1',
  contact: '', piedPage: 'Document généré localement — données stockées sur cet appareil.',
  numeroPrefix: 'PV', afficherNonRenseignes: false, avertissementLocalVu: false,
  motDePasseSauvegarde: null,
};

export async function getSettings() {
  const rows = await db.getAll('settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in s || true) s[r.key] = r.value;
  return s;
}

export async function putSetting(key, value) {
  await db.put('settings', key, { key, value });
  return getSettings();
}

export async function putSettings(patch) {
  for (const [k, v] of Object.entries(patch)) await db.put('settings', k, { key: k, value: v });
  return getSettings();
}

/* ---------------- agents ---------------- */
export async function listAgents() {
  const a = await db.getAll('agents');
  return a.sort((x, y) => ((x.nom || '') + (x.prenom || '')).localeCompare((y.nom || '') + (y.prenom || ''), 'fr'));
}
export async function putAgent(agent) {
  const a = { id: agent.id || uid(), ...agent };
  await db.put('agents', a.id, a);
  return a;
}
export async function delAgent(id) { await db.del('agents', id); }

/* ---------------- procédés personnalisés ---------------- */
export async function listProcedures() {
  const p = await db.getAll('procedures');
  return p.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
}
export async function putProcedure(p) {
  const rec = { id: p.id || uid(), ...p };
  await db.put('procedures', rec.id, rec);
  return rec;
}
export async function delProcedure(id) { await db.del('procedures', id); }

/* ---------------- dossiers PV ---------------- */
async function nextNumero() {
  const meta = (await db.get('meta', 'seq')) || { key: 'seq', value: 0 };
  meta.value = (meta.value || 0) + 1;
  await db.put('meta', meta.key, meta);
  const settings = await getSettings();
  const prefix = settings.numeroPrefix || 'PV';
  return `${prefix}-${new Date().getFullYear()}-${String(meta.value).padStart(3, '0')}`;
}

export async function listPVs() {
  const pvs = await db.getAll('pvs');
  return pvs.sort((a, b) => (b.modifieLe || '').localeCompare(a.modifieLe || ''));
}

export async function getPV(id) { return db.get('pvs', id); }

export async function createPV(data = {}) {
  const ref = await getReferentiel();
  const now = new Date().toISOString();
  const pv = {
    id: uid(),
    numero: data.numero || (await nextNumero()),
    intitule: data.intitule || '', ouvrage: data.ouvrage || '', localisation: data.localisation || '',
    maitreOuvrage: '', maitreOeuvre: '', entreprise: '', entrepriseEtancheite: '',
    lot: '', natureTravaux: '', procedeId: '', fabricant: '', referenceSysteme: '',
    refsDocTechniques: '', meteo: '', observations: '',
    support: '', familleId: data.familleId || '', procedeNom: '',
    statut: 'preparation', archive: false, demo: false,
    interventions: [], resultats: {}, photos: [],
    refOverrides: {},
    referentielSnapshot: cloneSnapshot(ref),
    conclusion: '', synthese: '',
    creeLe: now, modifieLe: now, editeLe: null,
  };
  Object.assign(pv, data);
  pv.referentielSnapshot = cloneSnapshot(ref);
  await db.put('pvs', pv.id, pv);
  return pv;
}

export async function savePV(pv) {
  pv.modifieLe = new Date().toISOString();
  await db.put('pvs', pv.id, pv);
  emit('saved');
  return pv;
}

export async function duplicatePV(id) {
  const src = await getPV(id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy = deepClone(src);
  copy.id = uid();
  copy.numero = await nextNumero();
  copy.statut = 'preparation';
  copy.archive = false;
  copy.editeLe = null;
  copy.creeLe = now; copy.modifieLe = now;
  copy.intitule = (copy.intitule || '') + ' (copie)';
  for (const ph of copy.photos || []) ph.id = uid();
  await db.put('pvs', copy.id, copy);
  return copy;
}

export async function deletePV(id) {
  const pv = await getPV(id);
  if (pv) for (const ph of pv.photos || []) await db.del('photos', ph.blobKey);
  await db.del('pvs', id);
}

/* Référentiel effectif d’un PV : snapshot figé à la création + surcharges propres à l’opération. */
export function refEffectifPV(pv) {
  const snap = pv.referentielSnapshot || null;
  if (!snap) return null;
  const ref = deepClone(snap);
  const ov = pv.refOverrides || {};
  ref.controles = ref.controles.map((c) => (ov[c.id] ? { ...c, ...ov[c.id], id: c.id } : c));
  return ref;
}

export async function setResultat(pvId, controlId, patch) {
  const pv = await getPV(pvId);
  pv.resultats = pv.resultats || {};
  const cur = pv.resultats[controlId] || {};
  pv.resultats[controlId] = { ...cur, ...patch, modifieLe: new Date().toISOString() };
  return savePV(pv);
}

export async function delResultat(pvId, controlId) {
  const pv = await getPV(pvId);
  delete pv.resultats[controlId];
  return savePV(pv);
}

export async function addIntervention(pvId, data) {
  const pv = await getPV(pvId);
  pv.interventions.push({ id: uid(), date: todayISO(), heure: '', description: '', agentIds: [], clientIds: [], observations: '', ...data });
  return savePV(pv);
}

export async function saveIntervention(pvId, intervention) {
  const pv = await getPV(pvId);
  const i = pv.interventions.findIndex((x) => x.id === intervention.id);
  if (i >= 0) pv.interventions[i] = intervention;
  return savePV(pv);
}

export async function delIntervention(pvId, interventionId) {
  const pv = await getPV(pvId);
  pv.interventions = pv.interventions.filter((x) => x.id !== interventionId);
  for (const cid of Object.keys(pv.resultats)) {
    if (pv.resultats[cid].interventionId === interventionId) delete pv.resultats[cid].interventionId;
  }
  pv.photos = (pv.photos || []).map((p) => (p.interventionId === interventionId ? { ...p, interventionId: null } : p));
  return savePV(pv);
}

/* ---------------- photos ---------------- */
export async function addPhoto(pvId, { file, legende = '', controlId = null, phaseId = null, interventionId = null }) {
  const pv = await getPV(pvId);
  const compressed = await compressImageFile(file);
  const blobKey = uid();
  await db.put('photos', blobKey, { key: blobKey, blob: compressed.blob, type: compressed.type, size: compressed.size, width: compressed.width, height: compressed.height, creeLe: new Date().toISOString() });
  const ordre = (pv.photos || []).length + 1;
  const photo = { id: uid(), blobKey, legende, controlId, phaseId, interventionId, ordre, creeLe: new Date().toISOString() };
  pv.photos.push(photo);
  await savePV(pv);
  return photo;
}

export async function getPhotoBlob(blobKey) {
  const rec = await db.get('photos', blobKey);
  return rec ? rec.blob : null;
}

export async function updatePhoto(pvId, photoId, patch) {
  const pv = await getPV(pvId);
  const p = pv.photos.find((x) => x.id === photoId);
  if (p) Object.assign(p, patch);
  return savePV(pv);
}

export async function replacePhotoBlob(pvId, photoId, file) {
  const pv = await getPV(pvId);
  const p = pv.photos.find((x) => x.id === photoId);
  if (!p) return null;
  const compressed = await compressImageFile(file);
  await db.put('photos', p.blobKey, { key: p.blobKey, blob: compressed.blob, type: compressed.type, size: compressed.size, width: compressed.width, height: compressed.height, creeLe: new Date().toISOString() });
  return savePV(pv);
}

export async function deletePhoto(pvId, photoId) {
  const pv = await getPV(pvId);
  const p = pv.photos.find((x) => x.id === photoId);
  if (p) await db.del('photos', p.blobKey);
  pv.photos = pv.photos.filter((x) => x.id !== photoId);
  pv.photos.sort((a, b) => a.ordre - b.ordre).forEach((x, i) => (x.ordre = i + 1));
  return savePV(pv);
}

export async function movePhoto(pvId, photoId, dir) {
  const pv = await getPV(pvId);
  pv.photos.sort((a, b) => a.ordre - b.ordre);
  const i = pv.photos.findIndex((x) => x.id === photoId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pv.photos.length) return pv;
  [pv.photos[i], pv.photos[j]] = [pv.photos[j], pv.photos[i]];
  pv.photos.forEach((x, k) => (x.ordre = k + 1));
  return savePV(pv);
}

/* ---------------- sauvegarde / restauration ---------------- */
async function encryptIfNeeded(u8, passphrase) {
  if (!passphrase) return { data: u8, encrypted: false };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, u8));
  const out = new Uint8Array(salt.length + iv.length + enc.length);
  out.set(salt, 0); out.set(iv, salt.length); out.set(enc, salt.length + iv.length);
  return { data: out, encrypted: true };
}

async function decryptIfNeeded(u8, passphrase, encrypted) {
  if (!encrypted) return u8;
  if (!passphrase) throw new Error('Archive chiffrée : mot de passe requis.');
  const salt = u8.subarray(0, 16);
  const iv = u8.subarray(16, 28);
  const data = u8.subarray(28);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, data));
}

const te = new TextEncoder();
const td = new TextDecoder();

/* Archive d’un dossier : zip contenant manifest.json, dossier.json, meta.json (empreinte) et les photos. */
export async function exportDossier(pvId, { passphrase = '' } = {}) {
  const pv = await getPV(pvId);
  if (!pv) throw new Error('Dossier introuvable.');
  const dossierJson = JSON.stringify(pv, null, 1);
  const checksum = await sha256Hex(dossierJson);
  const files = {};
  const encDossier = await encryptIfNeeded(te.encode(dossierJson), passphrase);
  files['dossier.json' + (encDossier.encrypted ? '.enc' : '')] = encDossier.data;
  const photoEntries = [];
  for (const p of pv.photos || []) {
    const rec = await db.get('photos', p.blobKey);
    if (!rec) continue;
    const u8 = new Uint8Array(await rec.blob.arrayBuffer());
    const enc = await encryptIfNeeded(u8, passphrase);
    const name = `photos/${p.id}${enc.encrypted ? '.jpg.enc' : '.jpg'}`;
    files[name] = enc.data;
    photoEntries.push({ id: p.id, file: name, encrypted: enc.encrypted });
  }
  const manifest = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, kind: 'dossier', appVersion: APP_VERSION,
    exportDate: new Date().toISOString(), numero: pv.numero,
    encrypted: !!passphrase, photos: photoEntries,
  };
  files['manifest.json'] = te.encode(JSON.stringify(manifest, null, 1));
  files['meta.json'] = te.encode(JSON.stringify({ checksum, checksumAlgo: 'SHA-256', dossierFile: encDossier.encrypted ? 'dossier.json.enc' : 'dossier.json' }, null, 1));
  return fflate.zipSync(files, { level: 6 });
}

export async function exportGlobal({ passphrase = '' } = {}) {
  const pvs = await db.getAll('pvs');
  const photos = await db.getAll('photos');
  const payload = {
    settings: await db.getAll('settings'), meta: await db.getAll('meta'),
    agents: await db.getAll('agents'), procedures: await db.getAll('procedures'),
    referentiel: await db.getAll('referentiel'), refHistory: await db.getAll('refHistory'),
    pvs,
  };
  const payloadJson = JSON.stringify(payload);
  const checksum = await sha256Hex(payloadJson);
  const files = {};
  const enc = await encryptIfNeeded(te.encode(payloadJson), passphrase);
  files['data.json' + (enc.encrypted ? '.enc' : '')] = enc.data;
  const photoEntries = [];
  for (const rec of photos) {
    const u8 = new Uint8Array(await rec.blob.arrayBuffer());
    const e = await encryptIfNeeded(u8, passphrase);
    const name = `photos/${rec.key}${e.encrypted ? '.jpg.enc' : '.jpg'}`;
    files[name] = e.data;
    photoEntries.push({ key: rec.key, file: name, encrypted: e.encrypted });
  }
  files['manifest.json'] = te.encode(JSON.stringify({
    format: BACKUP_FORMAT, version: BACKUP_VERSION, kind: 'global', appVersion: APP_VERSION,
    exportDate: new Date().toISOString(), encrypted: !!passphrase, photos: photoEntries,
  }, null, 1));
  files['meta.json'] = te.encode(JSON.stringify({ checksum, checksumAlgo: 'SHA-256', dataFile: enc.encrypted ? 'data.json.enc' : 'data.json' }, null, 1));
  return fflate.zipSync(files, { level: 6 });
}

/* Import d’une archive (dossier ou global). Retourne un rapport. */
export async function importArchive(u8, { passphrase = '', mode = 'fusion' } = {}) {
  const zip = fflate.unzipSync(u8);
  const manifest = JSON.parse(td.decode(zip['manifest.json']));
  if (!manifest || manifest.format !== BACKUP_FORMAT) throw new Error("Format d’archive non reconnu.");
  const meta = JSON.parse(td.decode(zip['meta.json']));
  const dataFile = meta.dataFile || (manifest.kind === 'dossier' ? 'dossier.json' : 'data.json');
  const rawEnc = zip[dataFile] || zip[dataFile + '.enc'];
  if (!rawEnc) throw new Error('Contenu de l archive illisible.');
  const raw = await decryptIfNeeded(rawEnc, passphrase, manifest.encrypted);
  const jsonText = td.decode(raw);
  const checksum = await sha256Hex(jsonText);
  if (checksum !== meta.checksum) throw new Error("Échec du contrôle d’intégrité (empreinte SHA-256) : archive altérée ou mot de passe incorrect.");

  if (manifest.kind === 'dossier') {
    const pv = JSON.parse(jsonText);
    const rapport = { kind: 'dossier', numero: pv.numero, photos: 0, doublon: false };
    const existing = (await listPVs()).find((p) => p.numero === pv.numero && !p.demo);
    if (existing && mode === 'fusion') { rapport.doublon = true; rapport.existingId = existing.id; return rapport; }
    if (existing) { pv.id = uid(); pv.numero = await nextNumero(); }
    for (const pe of manifest.photos || []) {
      const u = zip[pe.file];
      if (!u) continue;
      const blobBytes = await decryptIfNeeded(u, passphrase, pe.encrypted);
      const bk = pv.photos.find((p) => p.id === pe.id)?.blobKey || pe.id;
      await db.put('photos', bk, { key: bk, blob: new Blob([blobBytes], { type: 'image/jpeg' }), creeLe: new Date().toISOString() });
      rapport.photos++;
    }
    await db.put('pvs', pv.id, pv);
    return rapport;
  }

  const payload = JSON.parse(jsonText);
  const rapport = { kind: 'global', pvs: payload.pvs.length, photos: 0 };
  for (const pe of manifest.photos || []) {
    const u = zip[pe.file];
    if (!u) continue;
    const blobBytes = await decryptIfNeeded(u, passphrase, pe.encrypted);
    await db.put('photos', pe.key, { key: pe.key, blob: new Blob([blobBytes], { type: 'image/jpeg' }), creeLe: new Date().toISOString() });
    rapport.photos++;
  }
  const restore = async (store, rows) => { for (const r of rows || []) await db.put(store, r.id ?? r.key, r); };
  await restore('settings', payload.settings);
  await restore('meta', payload.meta);
  await restore('agents', payload.agents);
  await restore('procedures', payload.procedures);
  await restore('referentiel', payload.referentiel);
  await restore('refHistory', payload.refHistory);
  for (const pv of payload.pvs || []) await db.put('pvs', pv.id, pv);
  return rapport;
}
