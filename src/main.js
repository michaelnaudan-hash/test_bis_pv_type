/* Point d’entrée : routeur, enregistrement du service worker, indicateurs
 * (hors connexion / sauvegarde), navigation. */
import { openDB } from './db.js';
import * as store from './store.js';
import { on } from './bus.js';
import { toast } from './ui.js';
import * as voice from './voice.js';

const view = document.getElementById('view');
const routes = {};

export function route(path, fn) { routes[path] = fn; }

const ctx = {
  view,
  navigate: (h) => { location.hash = h; },
  toast,
  store,
  voice,
};

async function loadView(name, params) {
  view.innerHTML = '';
  view.focus();
  const mod = await import(`./views/${name}.js`);
  await mod.render(ctx, params);
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === (params.nav || name));
  });
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0, 0);
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = h.split('/').filter(Boolean);
  if (!parts.length) return { name: 'dashboard', params: { nav: 'dashboard' } };
  if (parts[0] === 'pv' && parts[1]) {
    return { name: 'pv-edit', params: { id: parts[1], tab: parts[2] || 'general', nav: 'dossiers' } };
  }
  const known = ['dashboard', 'dossiers', 'referentiel', 'procedures', 'agents', 'parametres', 'sauvegarde', 'recette', 'aide'];
  if (known.includes(parts[0])) return { name: parts[0], params: { nav: parts[0] } };
  return { name: 'dashboard', params: { nav: 'dashboard' } };
}

async function router() {
  const { name, params } = parseHash();
  try {
    await loadView(name, params);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="alert err">Erreur d’affichage : ${e.message || e}</div>`;
  }
}

function updateBadges() {
  const off = document.getElementById('badge-offline');
  if (navigator.onLine) {
    off.textContent = 'En ligne';
    off.className = 'badge badge-on';
    off.title = 'Connexion Internet disponible — l application fonctionne aussi hors ligne';
  } else {
    off.textContent = 'Hors ligne';
    off.className = 'badge badge-off';
    off.title = 'Fonctionnement 100 % hors connexion : toutes les fonctionnalités métier restent disponibles';
  }
}

let saveTimer = null;
function markSaved() {
  const b = document.getElementById('badge-save');
  b.textContent = 'Enregistrement…';
  b.className = 'badge badge-warn';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    b.textContent = 'Enregistré ✓ (local)';
    b.className = 'badge badge-ok';
  }, 400);
}

async function boot() {
  await openDB();
  await store.loadReferentielBase();
  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.querySelectorAll('.nav-link').forEach((a) => a.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  }));
  window.addEventListener('online', updateBadges);
  window.addEventListener('offline', updateBadges);
  window.addEventListener('hashchange', router);
  on('saved', markSaved);
  updateBadges();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) {
      console.warn('Service worker non enregistré (lancement en http local non sécurisé ?)', e);
    }
  }
  voice.warmModelCache();

  const settings = await store.getSettings();
  if (!settings.avertissementLocalVu) {
    await store.putSetting('avertissementLocalVu', true);
  }
  await router();
}

boot();
