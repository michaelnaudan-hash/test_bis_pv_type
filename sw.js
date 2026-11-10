/* Service worker — Offline First.
 * Le noyau de l'application (shell + bibliothèques) est pré-caché à l'installation.
 * Le modèle de reconnaissance vocale (models/fr-small.tar.gz, ~42 Mo) est mis en cache
 * à la première utilisation (fetch runtime), puis servi hors ligne ensuite.
 */
const CACHE = 'pv-etancheite-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/icons/favicon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'vendor/fflate.umd.js',
  'vendor/jspdf.umd.min.js',
  'vendor/jspdf.plugin.autotable.min.js',
  'vendor/vosk/vosk.js',
  'data/referentiel.json',
  'src/main.js',
  'src/util.js',
  'src/db.js',
  'src/model.js',
  'src/store.js',
  'src/bus.js',
  'src/ui.js',
  'src/docmodel.js',
  'src/photos.js',
  'src/voice.js',
  'src/demo.js',
  'src/export/common.js',
  'src/export/pdf.js',
  'src/export/docx.js',
  'src/export/odt.js',
  'src/views/dashboard.js',
  'src/views/dossiers.js',
  'src/views/pv-edit.js',
  'src/views/controles.js',
  'src/views/referentiel-admin.js',
  'src/views/procedures.js',
  'src/views/agents.js',
  'src/views/parametres.js',
  'src/views/sauvegarde.js',
  'src/views/recette.js',
  'src/views/aide.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
