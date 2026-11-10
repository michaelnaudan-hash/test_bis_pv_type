/* Tests unitaires Node de la logique métier pure (sans navigateur).
 * Exécution : node tests/logic.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  controlesApplicables, evaluerConformite, conclusionAuto, coherencePV, etatAvancement, estRenseigne,
} from '../src/model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = JSON.parse(readFileSync(join(root, 'data/referentiel.json'), 'utf8'));

let passed = 0, failed = 0;
const t = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  OK  ${name}`); }
  else { failed++; console.log(`  ÉCHEC  ${name} ${detail}`); }
};

console.log('== Référentiel importé depuis l Excel ==');
t('58 points de contrôle', ref.controles.length === 58, `obtenu ${ref.controles.length}`);
t('7 phases', ref.phases.length === 7);
t('5 familles', ref.familles.length === 5);
t('meta avertissement présent', !!ref.meta.avertissement);
t('chaque contrôle a les propriétés requises', ref.controles.every((c) =>
  c.id && c.code && c.phaseId && c.intitule && c.exigence && c.methode && c.frequence &&
  ['commun', 'beton', 'acier'].includes(c.support) && c.source));

console.log('== Filtrage support (tests CDC 2 & 3) ==');
const beton = controlesApplicables(ref.controles, { support: 'beton', familleId: 'FPM' });
const acier = controlesApplicables(ref.controles, { support: 'acier', familleId: 'SESM' });
t('béton : aucun contrôle spécifique acier', beton.every((c) => c.support !== 'acier'));
t('béton : contrôles spécifiques béton présents', beton.some((c) => c.support === 'beton'));
t('béton : contrôles communs présents', beton.some((c) => c.support === 'commun'));
t('acier : aucun contrôle spécifique béton', acier.every((c) => c.support !== 'beton'));
t('acier : contrôles spécifiques acier présents', acier.some((c) => c.support === 'acier'));
t('SESM sur acier inclut le contrôle SESM', controlesApplicables(ref.controles, { support: 'acier', familleId: 'SESM' }).some((c) => c.famille === 'SESM'));
t('FPM sur béton inclut les contrôles feuilles', controlesApplicables(ref.controles, { support: 'beton', familleId: 'FPM' }).some((c) => c.famille === 'FPM'));
t('famille SEL exclut les contrôles feuilles', !controlesApplicables(ref.controles, { support: 'beton', familleId: 'SEL' }).some((c) => c.famille === 'FPM'));

console.log('== Conformité automatique (test CDC 7.2) ==');
const max8 = { mesure: { type: 'max', max: 8, unite: 'mm' } };
const min15 = { mesure: { type: 'min', min: 1.5, unite: 'MPa' } };
const plage = { mesure: { type: 'plage', min: 60, max: 240, unite: 's' } };
const cible = { mesure: { type: 'cible', cible: 20, tolerance: 3, unite: '°C' } };
t('max 8 : 4 conforme', evaluerConformite(max8, 4) === 'conforme');
t('max 8 : 12 non conforme', evaluerConformite(max8, 12) === 'non_conforme');
t('min 1.5 : 2 conforme', evaluerConformite(min15, 2) === 'conforme');
t('min 1.5 : 1 non conforme', evaluerConformite(min15, 1) === 'non_conforme');
t('plage 60-240 : 120 conforme', evaluerConformite(plage, 120) === 'conforme');
t('plage 60-240 : 300 non conforme', evaluerConformite(plage, 300) === 'non_conforme');
t('cible 20±3 : 22 conforme', evaluerConformite(cible, 22) === 'conforme');
t('cible 20±3 : 30 non conforme', evaluerConformite(cible, 30) === 'non_conforme');
t('jamais de conclusion sans critère', evaluerConformite({ mesure: null }, 5) === null);
t('jamais de conclusion sans mesure', evaluerConformite(max8, '') === null && evaluerConformite(max8, null) === null);

console.log('== Conclusion automatique (test CDC 10.3) ==');
const mkPV = (statuts) => ({
  support: 'beton', familleId: 'FPM',
  resultats: Object.fromEntries(beton.map((c, i) => [c.id, { statut: statuts[i % statuts.length] }])),
});
const tousOK = conclusionAuto(mkPV(['conforme', 'conforme_reserves', 'non_applicable']), ref);
t('tous conformes/réserves/N.A. → avis favorable', tousOK.avis === 'favorable');
const avecNC = conclusionAuto(mkPV(['conforme', 'non_conforme', 'conforme']), ref);
t('présence d un NC → avis défavorable', avecNC.avis === 'défavorable');
t('texte défavorable ne déclare pas conforme', avecNC.texte.includes('AVIS : DÉFAVORABLE') && avecNC.texte.includes('NON CONFORMES'));
const avecAttente = conclusionAuto(mkPV(['conforme', 'en_attente', 'conforme']), ref);
t('présence d un en-attente → avis en attente (jamais conforme)', avecAttente.avis === 'en_attente');

console.log('== Cohérence & états (tests CDC 18/19) ==');
const pvVide = { numero: 'PV-T-1', intitule: '', ouvrage: '', support: '', familleId: '', resultats: {}, photos: [{ id: 'x', ordre: 1 }], interventions: [] };
const pb = coherencePV(pvVide, ref);
t('photo non rattachée signalée', pb.some((m) => m.includes('rattach')));
t('champs manquants signalés', pb.some((m) => m.includes('Support')) && pb.some((m) => m.includes('intervention')));
t('état préparation si rien de renseigné', etatAvancement({ support: 'beton', familleId: 'FPM', resultats: {} }, ref) === 'preparation');
const pvR = { support: 'beton', familleId: 'FPM', resultats: Object.fromEntries(beton.map((c) => [c.id, { statut: 'conforme' }])), conclusion: 'x' };
t('état finalisé si tout renseigné + conclusion', etatAvancement(pvR, ref) === 'finalise');
t('estRenseigne exige un statut explicite', !estRenseigne({ mesure: 3 }) && estRenseigne({ statut: 'non_applicable' }));

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
