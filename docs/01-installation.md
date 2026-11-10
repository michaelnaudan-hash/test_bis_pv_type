# Guide d'installation

## 1. Prérequis

- Un navigateur moderne (Chrome/Edge 90+, Firefox 90+, Safari 15+) avec WebAssembly (requis pour la dictée vocale hors connexion).
- Aucun serveur applicatif n'est nécessaire : l'application est un ensemble de fichiers statiques.
- **Premier chargement obligatoirement en ligne** (ou sur le réseau local) : le service worker met alors en cache l'intégralité de l'application (shell + bibliothèques + référentiel). Le modèle de reconnaissance vocale (~42 Mo) est mis en cache à la première utilisation de la dictée (ou en arrière-plan lors du premier chargement si l'appareil est en ligne).

## 2. Lancement local (ordinateur)

Depuis la racine du projet :

```bash
cd pv-etancheite
python3 -m http.server 8080
# ou : npx serve .   /   php -S localhost:8080
```

Ouvrir `http://localhost:8080/` dans le navigateur.

> Un serveur HTTP est nécessaire (et non `file://`) car les modules ES, le service worker et IndexedDB l'exigent. `localhost` est considéré comme un contexte sécurisé.

## 3. Installation en application (PWA)

- **Windows / Android (Chrome, Edge)** : barre d'adresse → icône « Installer » ou menu ⋮ → « Installer l'application ». L'icône « PV Étanchéité » est créée ; l'application s'ouvre en fenêtre autonome.
- **iPhone / iPad (Safari)** : bouton Partager → « Sur l'écran d'accueil ». Les fonctionnalités hors connexion (service worker, IndexedDB) fonctionnent ; la dictée vocale Vosk/WASM est disponible sur iOS 15+ récent.

Après l'installation, **débrancher Internet** : tout continue de fonctionner (création, saisie, photos, dictée, PDF/Word/ODT, sauvegardes). L'indicateur en haut de l'écran passe « Hors ligne ».

## 4. Déploiement sur un serveur local / intranet

Copier le contenu du dossier sur n'importe quel serveur de fichiers statiques (nginx, Apache, IIS, partage réseau servi en HTTP) :

```nginx
location /pv-etancheite/ {
  alias /var/www/pv-etancheite/;
  types { application/manifest+json webmanifest; }
}
```

Aucun appel externe n'est effectué par l'application : aucune API distante, aucun CDN, aucune télémétrie.

## 5. Vérification hors connexion

1. Charger l'application une fois en ligne, l'installer.
2. Couper le réseau (mode avion).
3. Rouvrir l'application installée → le tableau de bord s'affiche.
4. Menu « ✅ Tests de recette » → lancer : tous les tests doivent passer hors connexion.

## 6. Mise à jour

Remplacer les fichiers du dossier (conserver `models/` si inchangé), puis vider le cache du navigateur / réinstaller la PWA. Les données (IndexedDB) sont conservées. Le service worker détecte la nouvelle version (nom de cache incrémenté) et re-télécharge le shell.
