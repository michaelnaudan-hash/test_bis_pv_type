/* Dictée vocale 100 % hors ligne via Vosk (WebAssembly) + modèle français embarqué
 * (models/fr-small.tar.gz, mis en cache par le service worker à la première utilisation).
 * Le texte reconnu est toujours modifiable manuellement avant validation.
 * Repli : API Web Speech Recognition si disponible (peut nécessiter Internet selon le navigateur) ;
 * sinon message explicite — jamais de simulation. */

const MODEL_URL = 'models/fr-small.tar.gz';

let modelPromise = null;
let activeSession = null;

async function ensureModel(onProgress) {
  if (window.Vosk && modelPromise) return modelPromise;
  if (!window.Vosk) throw new Error("Moteur Vosk non chargé (vendor/vosk/vosk.js).");
  modelPromise = window.Vosk.createModel(MODEL_URL, -1).catch((e) => { modelPromise = null; throw e; });
  if (onProgress) onProgress('Chargement du modèle de reconnaissance vocale hors ligne…');
  return modelPromise;
}

/* Démarre une session de dictée. callbacks : onPartial, onResult, onEnd, onError. */
export async function start({ onPartial, onResult, onEnd, onError } = {}) {
  stop();
  try {
    const model = await ensureModel();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AC();
    if (audioContext.sampleRate !== 16000) {
      // resample via OfflineAudioContext non nécessaire : on convertit manuellement
    }
    const source = audioContext.createMediaStreamSource(stream);
    const recognizer = new model.KaldiRecognizer(16000);
    recognizer.on('result', (msg) => {
      const text = (msg.result && msg.result.text) || '';
      if (text && onResult) onResult(capitalize(text));
    });
    recognizer.on('partialresult', (msg) => {
      const text = (msg.result && msg.result.partial) || '';
      if (onPartial) onPartial(text);
    });
    recognizer.on('error', (msg) => { if (onError) onError(msg.error || 'Erreur de reconnaissance'); });

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (ev) => {
      try {
        const input = ev.inputBuffer.getChannelData(0);
        const down = downsampleTo16k(input, audioContext.sampleRate);
        recognizer.acceptWaveformFloat(down, 16000);
      } catch (e) { /* chunk ignoré */ }
    };
    source.connect(processor);
    processor.connect(audioContext.destination);

    activeSession = {
      stop: () => {
        try { recognizer.retrieveFinalResult(); } catch (e) {}
        try { processor.disconnect(); source.disconnect(); } catch (e) {}
        stream.getTracks().forEach((t) => t.stop());
        audioContext.close().catch(() => {});
        try { recognizer.remove(); } catch (e) {}
        activeSession = null;
        if (onEnd) onEnd();
      },
    };
    return activeSession;
  } catch (e) {
    // Repli Web Speech API (peut nécessiter une connexion selon le navigateur)
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      return startWebSpeech({ onPartial, onResult, onEnd, onError });
    }
    if (onError) onError(e.message || String(e));
    if (onEnd) onEnd();
    return null;
  }
}

export function stop() {
  if (activeSession) { const s = activeSession; activeSession = null; s.stop(); return true; }
  return false;
}

export function isRecording() { return !!activeSession; }

/* Mise en forme : majuscule initiale + point final si absent. */
function capitalize(t) {
  t = t.trim();
  if (!t) return t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

function downsampleTo16k(buffer, sampleRate) {
  if (sampleRate === 16000) return buffer;
  const ratio = sampleRate / 16000;
  const newLen = Math.round(buffer.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) out[i] = buffer[Math.floor(i * ratio)];
  return out;
}

function startWebSpeech({ onPartial, onResult, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = '';
  rec.onresult = (ev) => {
    let partial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) { finalText += r[0].transcript + ' '; if (onResult) onResult(capitalize(r[0].transcript)); }
      else partial += r[0].transcript;
    }
    if (onPartial && partial) onPartial(partial);
  };
  rec.onerror = (ev) => { if (onError && ev.error !== 'aborted') onError(ev.error); };
  rec.onend = () => { activeSession = null; if (onEnd) onEnd(); };
  try { rec.start(); } catch (e) { if (onError) onError(e.message || String(e)); if (onEnd) onEnd(); return null; }
  activeSession = { stop: () => { try { rec.stop(); } catch (e) {} } };
  return activeSession;
}

/* Pré-chauffe le cache du modèle (à appeler quand l’appareil est en ligne, au premier chargement). */
export async function warmModelCache() {
  try {
    if (!navigator.onLine) return;
    await fetch(MODEL_URL, { cache: 'force-cache' }).catch(() => {});
  } catch (e) { /* le cache sera rempli à la première dictée */ }
}
