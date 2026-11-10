/* Jeu de données de démonstration : dossier clairement étiqueté DÉMO (données fictives,
 * non présentées comme des contrôles réellement effectués), avec plusieurs dates
 * d’intervention, plusieurs phases renseignées et des photographies légendées générées
 * artificiellement (visuellement marquées « DÉMONSTRATION »). */
import * as store from './store.js';
import { uid } from './util.js';

function demoPhotoBlob(text, hue) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 900;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1200, 900);
    g.addColorStop(0, `hsl(${hue},45%,55%)`);
    g.addColorStop(1, `hsl(${hue + 40},50%,35%)`);
    x.fillStyle = g; x.fillRect(0, 0, 1200, 900);
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.fillRect(40, 40, 1120, 820);
    x.fillStyle = '#333';
    x.font = 'bold 64px sans-serif';
    x.fillText('PHOTO DE DÉMONSTRATION', 90, 380);
    x.font = '36px sans-serif';
    x.fillText(text, 90, 460);
    x.font = 'italic 28px sans-serif';
    x.fillStyle = '#6a1b9a';
    x.fillText('Image fictive générée localement — aucun contrôle réel', 90, 780);
    c.toBlob((b) => resolve(new File([b], 'demo.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.85);
  });
}

export async function seedDemo() {
  const existing = (await store.listPVs()).find((p) => p.demo);
  if (existing) return existing;

  const pv = await store.createPV({
    intitule: 'DÉMO — Rénovation de l étanchéité du tablier', ouvrage: 'Pont de la Demo rivière (exemple fictif)',
    localisation: 'RD 12 — PK 3+450 (exemple fictif)', maitreOuvrage: 'Conseil départemental (exemple)',
    maitreOeuvre: 'Bureau d études Exemple (exemple)', entreprise: 'Entreprise Exemple SAS (exemple)',
    entrepriseEtancheite: 'Étanchéité Exemple (exemple)', lot: 'Lot 3 — Étanchéité',
    natureTravaux: "Reprise de l’étanchéité du tablier (dépose du complexe existant, réfection)",
    support: 'beton', familleId: 'FPM', procedeNom: 'Feuilles bitumineuses préfabriquées (exemple)',
    fabricant: 'Fabricant Exemple', referenceSysteme: 'Système FPM-EX (exemple)',
    refsDocTechniques: 'CCTP lot 3 (exemple) ; Avis technique du procédé (exemple) ; PAQ (exemple)',
    meteo: 'Ciel dégagé, 18 °C, vent faible (exemple)', observations: "Dossier de démonstration : l’ensemble des valeurs et photos sont fictives.",
    demo: true,
  });

  const i1 = (await store.getPV(pv.id)).interventions;
  await store.addIntervention(pv.id, { date: '2025-03-10', heure: '09:00', description: 'Réception du support béton après dépose du complexe existant (exemple).', observations: 'Support globalement sain ; quelques ragréages à prévoir (exemple).' });
  await store.addIntervention(pv.id, { date: '2025-03-12', heure: '08:30', description: 'Mise en œuvre du primaire et des feuilles (exemple).', observations: 'Conditions favorables (exemple).' });
  await store.addIntervention(pv.id, { date: '2025-03-14', heure: '10:00', description: 'Contrôles de réception (adhérence, épaisseur) (exemple).', observations: '' });

  const p = await store.getPV(pv.id);
  const ivIds = p.interventions.map((i) => i.id);

  const results = {
    'CTL-SUP-01': { statut: 'conforme', mesure: 4, commentaire: 'Écart mesuré 4 mm sous la règle de 2 m (exemple).' },
    'CTL-SUP-03': { statut: 'conforme', mesure: 0.8, commentaire: 'PMT 0,8 mm (exemple).' },
    'CTL-SUP-05': { statut: 'conforme', mesure: 3.2, commentaire: 'Humidité 3,2 % en masse au carbure (exemple).' },
    'CTL-SUP-07': { statut: 'conforme', commentaire: 'Support propre, laitance éliminée par grenaillage léger (exemple).' },
    'CTL-SUP-15': { statut: 'conforme', commentaire: 'PV contradictoire de réception du support établi (exemple).' },
    'CTL-AMB-01': { statut: 'conforme', mesure: 18, commentaire: '18 °C support et air (exemple).' },
    'CTL-AMB-06': { statut: 'conforme', commentaire: 'Fiches de suivi renseignées chaque journée (exemple).' },
    'CTL-ACC-01': { statut: 'conforme_reserves', commentaire: 'Dosage EIF conforme ; une zone de 2 m² à redoubler (réserve levée le 13/03) (exemple).' },
    'CTL-FEU-01': { statut: 'conforme', commentaire: 'Pose en tuile depuis le point bas, recouvrements conformes (exemple).' },
    'CTL-FEU-02': { statut: 'conforme', commentaire: 'Bourrelet de fusion régulier, pas de surchauffe (exemple).' },
    'CTL-REC-01': { statut: 'conforme', commentaire: 'Aucune lésion constatée (exemple).' },
    'CTL-REC-03': { statut: 'en_attente', commentaire: 'Essais d adhérence prévus en laboratoire — résultats attendus (exemple).' },
    'CTL-REC-08': { statut: 'en_attente', commentaire: 'PV de réception à établir après réception des résultats de laboratoire (exemple).' },
    'CTL-PRO-02': { statut: 'conforme', commentaire: 'Circulation piétonne seule constatée (exemple).' },
  };
  for (const [cid, r] of Object.entries(results)) {
    await store.setResultat(pv.id, cid, { ...r, interventionId: ivIds[0] && (cid.startsWith('CTL-SUP') ? ivIds[0] : cid.startsWith('CTL-AMB') || cid.startsWith('CTL-ACC') || cid.startsWith('CTL-FEU') ? ivIds[1] : ivIds[2]) });
  }

  const photos = [
    ['CTL-SUP-07', 'État du support béton après préparation (photo fictive).', 210],
    ['CTL-SUP-15', 'Réception contradictoire du support (photo fictive).', 220],
    ['CTL-ACC-01', 'Application du primaire / EIF (photo fictive).', 230],
    ['CTL-FEU-02', 'Soudure des feuilles — bourrelet de fusion (photo fictive).', 240],
    ['CTL-REC-01', 'Aspect général de la chape après réception visuelle (photo fictive).', 250],
  ];
  for (const [cid, legende, hue] of photos) {
    const ctrl = pv.referentielSnapshot.controles.find((c) => c.id === cid);
    const file = await demoPhotoBlob(legende, hue);
    await store.addPhoto(pv.id, { file, legende, controlId: cid, phaseId: ctrl?.phaseId || null, interventionId: ivIds[1] });
  }
  const fileInt = await demoPhotoBlob('Vue d ensemble du chantier — intervention du 10/03 (photo fictive).', 200);
  await store.addPhoto(pv.id, { file: fileInt, legende: "Vue d’ensemble du chantier (photo fictive).", interventionId: ivIds[0] });

  const final = await store.getPV(pv.id);
  final.conclusion = '';
  await store.savePV(final);
  return final;
}
