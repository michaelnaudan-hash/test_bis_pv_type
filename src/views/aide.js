/* Aide & documentation embarquée (fonctionne hors connexion). */
import { h } from '../ui.js';

export async function render(ctx) {
  ctx.view.append(h('h1', { style: 'color:var(--primary-dark);margin:0 0 12px' }, 'Aide & documentation'));
  ctx.view.append(h('div', { class: 'card' }, h('div', { html: `
<h2>Utilisation rapide</h2>
<ol>
<li><b>Créer un PV</b> : Tableau de bord → « Créer un nouveau PV » (renseignez l’opération, l’ouvrage, le <b>support</b> béton/acier et la <b>famille de procédé</b> : le référentiel de contrôles est automatiquement filtré).</li>
<li><b>Renseigner</b> : onglet « ✅ Contrôles » — choisissez le statut de chaque point (Conforme / Non conforme / Conforme sous réserves / Non applicable / En attente), saisissez la mesure si le critère est quantifié (la conformité est alors proposée automatiquement, jamais déduite sans critère), dictez les commentaires avec 🎙️ (reconnaissance vocale <b>hors connexion</b>, moteur Vosk embarqué), ajoutez des photos 📷 rattachées à chaque contrôle.</li>
<li><b>Plusieurs journées</b> : onglet « 📅 Interventions » — ajoutez autant de dates que nécessaire et rattachez-y contrôles et photos.</li>
<li><b>Générer</b> : onglet « 📄 Exporter » — PDF, Word (.docx) ou LibreOffice (.odt), 100 % hors connexion. Les rubriques non renseignées n’apparaissent pas ; les photos figurent en fin de chaque phase concernée.</li>
<li><b>Sauvegarder</b> : menu 💾 — exportez un dossier (.pvpack, chiffrement optionnel) ou une sauvegarde globale ; importez-la sur un autre appareil pour transférer le dossier.</li>
</ol>
<h2>Stockage local & sauvegarde</h2>
<p>Toutes les données sont stockées <b>localement sur cet appareil</b> (IndexedDB + stockage de blobs). Aucune donnée n’est envoyée sur Internet ; l’application fonctionne intégralement <b>hors connexion</b> après installation (icône « Hors ligne » en haut). Pensez à exporter régulièrement vos dossiers : en cas de perte de l’appareil, seules vos archives .pvpack permettent de les récupérer.</p>
<h2>Dictée vocale hors connexion</h2>
<p>Le bouton 🎙️ utilise le moteur <b>Vosk</b> (WebAssembly) avec un modèle français embarqué (<code>models/fr-small.tar.gz</code>, mis en cache par le service worker à la première utilisation). Aucun flux audio ne quitte l’appareil. Le texte reconnu reste modifiable avant validation. Sur les navigateurs où Vosk/WASM est indisponible, l’API Web Speech Recognition est utilisée en repli (peut nécessiter une connexion selon le navigateur) ; à défaut, un message explicite est affiché — aucune simulation.</p>
<h2>Valeurs du référentiel</h2>
<p>Les seuils livrés sont <b>indicatifs</b> (issus des fascicules 67-I / 65 et de la fiche MEMOAR X-1). Les valeurs <b>contractuelles applicables</b> sont celles du CCTP, du PAQ et de l’avis technique du procédé retenu, qui priment. Elles sont modifiables dans « 📋 Référentiel » (avec historique) et au niveau de chaque dossier. Chaque PV conserve une <b>copie figée</b> du référentiel utilisé.</p>
<h2>Documentation complète</h2>
<p>Consultez le dossier <code>docs/</code> du code source : guide d’installation, guide utilisateur, guide de paramétrage, guide d’administration, documentation technique, procédure de sauvegarde/restauration.</p>
<h2>Tests de recette</h2>
<p>Le menu « ✅ Tests de recette » exécute dans le navigateur les tests automatisés du cahier des charges (création, filtrage support, exports, sauvegarde, cohérence…).</p>
` })));
}
