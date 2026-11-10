/* Prise de photos (caméra ou import), compression intelligente côté navigateur,
 * stockage local des blobs dans IndexedDB (via store.js). */
export const PHOTO_MAX_DIM = 1600;
export const PHOTO_JPEG_QUALITY = 0.82;

/* Compresse une image (fichier) en JPEG borné à PHOTO_MAX_DIM, qualité suffisante
 * pour un rapport technique, poids maîtrisé. */
export function compressImageFile(file, { maxDim = PHOTO_MAX_DIM, quality = PHOTO_JPEG_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error('Compression impossible.'));
            resolve({ blob, type: 'image/jpeg', size: blob.size, width, height });
          },
          'image/jpeg', quality
        );
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible.")); };
    img.src = url;
  });
}

/* Capture via l’appareil photo (input capture) ou sélection de fichier. */
export function pickPhoto(useCamera = true) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (f) resolve(f); else reject(new Error('Aucune photo sélectionnée.'));
    };
    input.click();
  });
}

/* Flux vidéo direct dans un <video> avec prise de vue (fallback quand input[capture] est indisponible). */
export async function captureFromStream(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function takePictureFromVideo(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}
