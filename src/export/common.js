/* Commun aux exporteurs : résout les blocs image (photoId) en dataURL + dimensions. */
import * as db from '../db.js';
import { blobToDataURL } from '../util.js';

export async function prepareImages(model, pv) {
  const byId = new Map((pv.photos || []).map((p) => [p.id, p]));
  for (const b of model.blocks) {
    if (b.t !== 'img') continue;
    const meta = pv.photos?.find((p) => p.id === b.photoId);
    const rec = meta ? await db.get('photos', meta.blobKey) : null;
    if (rec) {
      b.dataUrl = await blobToDataURL(rec.blob);
      b.width = rec.width || 1600;
      b.height = rec.height || 1200;
      b.type = rec.type || 'image/jpeg';
    }
  }
  return model;
}

export const CHIP_COLORS = {
  conforme: { fg: '#1e7e34', bg: '#e6f4ea' },
  non_conforme: { fg: '#b71c1c', bg: '#fdecea' },
  conforme_reserves: { fg: '#b26a00', bg: '#fff4e0' },
  non_applicable: { fg: '#5f6368', bg: '#eef1f4' },
  en_attente: { fg: '#37474f', bg: '#e8eef7' },
};

export const AVIS_COLORS = {
  favorable: { fg: '#1e7e34', bg: '#e6f4ea' },
  défavorable: { fg: '#b71c1c', bg: '#fdecea' },
  defavorable: { fg: '#b71c1c', bg: '#fdecea' },
  en_attente: { fg: '#b26a00', bg: '#fff4e0' },
};

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
