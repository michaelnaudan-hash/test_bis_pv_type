/* Couche IndexedDB — toutes les données de l’application sont stockées localement. */
const DB_NAME = 'pv-etancheite';
const DB_VERSION = 1;

const STORES = ['settings', 'meta', 'agents', 'procedures', 'referentiel', 'refHistory', 'pvs', 'photos'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(store, key) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function put(store, key, value) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readwrite').objectStore(store).put(value, key));
}

export async function del(store, key) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

export async function clearStore(store) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readwrite').objectStore(store).clear());
}

export async function count(store) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).count());
}

export async function txAll(fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    const api = {
      get: (s, k) => reqToPromise(tx.objectStore(s).get(k)),
      put: (s, k, v) => reqToPromise(tx.objectStore(s).put(v, k)),
      del: (s, k) => reqToPromise(tx.objectStore(s).delete(k)),
      getAll: (s) => reqToPromise(tx.objectStore(s).getAll()),
    };
    Promise.resolve(fn(api)).then(
      () => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); },
      reject
    );
  });
}
