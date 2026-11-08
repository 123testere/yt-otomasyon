// Kanal sahibinin kendi sesiyle (Chatterbox) seslendirme. Kütüphane sadece gerektiğinde kurulur,
// çünkü kurulum ve model indirmesi birkaç dakika sürer.
import fs from 'node:fs/promises';
import path from 'node:path';
import { downloadVoiceSample } from '../lib/voice.js';
import { voiceStyleOf } from '../lib/options.js';
import { PY_DIR } from '../lib/paths.js';
import { run } from '../lib/util.js';
import { spellNumbersTr } from '../lib/numbers-tr.js';

const spokenText = (text, language) => (language === 'tr' ? spellNumbersTr(text) : text);

const PYTHON = process.env.PYTHON ?? 'python3';
let installed = false;

async function ensureChatterbox() {
  if (installed) return;
  try {
    await run(PYTHON, ['-c', 'import chatterbox']);
  } catch {
    console.log('  Chatterbox kuruluyor (ilk seferde birkaç dakika)…');
    await run(PYTHON, ['-m', 'pip', 'install', '-q', 'torch==2.6.0', 'torchaudio==2.6.0',
      '--index-url', 'https://download.pytorch.org/whl/cpu']);
    await run(PYTHON, ['-m', 'pip', 'install', '-q', 'chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git']);
  }
  installed = true;
}

// Kendi ses (Chatterbox veya ElevenLabs) bu video türünde kullanılacak mı?
export function voiceInScope(settings, type) {
  return ['klon', 'elevenlabs'].includes(settings.voiceSource) && (settings.cloneScope === 'hepsi' || type === 'short');
}

// Her sahne için ham WAV dosyalarını döndürür (sırayla).
// Dizi satırları için: verilen metinleri kanalın ses örneğiyle tek seferde seslendirir (model bir kez yüklenir).
export async function klonSatirlari(channelId, texts, language, dir, style = {}) {
  const sample = await downloadVoiceSample(channelId, path.join(dir, 'ornek.mp3'));
  const ref = path.join(dir, 'ornek.wav');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', sample, '-ac', '1', '-ar', '24000', ref]);
  await ensureChatterbox();
  const textsFile = path.join(dir, 'klon-metin.json');
  await fs.writeFile(textsFile, JSON.stringify(texts.map((t) => spokenText(t.trim(), language))));
  const outDir = path.join(dir, 'klon');
  await fs.mkdir(outDir, { recursive: true });
  const started = Date.now();
  await run(PYTHON, [path.join(PY_DIR, 'clone_tts.py'), ref, language, textsFile, outDir, JSON.stringify(style)]);
  console.log(`  kendi sesinle (Chatterbox) ${texts.length} satır ${Math.round((Date.now() - started) / 60000)} dk`);
  return texts.map((_, i) => path.join(outDir, `${String(i).padStart(3, '0')}.wav`));
}

export async function cloneNarrate(job, settings, dir) {
  const sample = await downloadVoiceSample(job.channelId, path.join(dir, 'ornek.mp3'));
  const ref = path.join(dir, 'ornek.wav');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', sample, '-ac', '1', '-ar', '24000', ref]);
  await ensureChatterbox();

  const textsFile = path.join(dir, 'klon-metin.json');
  await fs.writeFile(textsFile, JSON.stringify(job.scenes.map((s) => spokenText(s.narration.trim(), settings.language))));
  const outDir = path.join(dir, 'klon');
  await fs.mkdir(outDir, { recursive: true });
  const started = Date.now();
  await run(PYTHON, [path.join(PY_DIR, 'clone_tts.py'), ref, settings.language, textsFile, outDir,
    JSON.stringify(voiceStyleOf(settings).chatterbox ?? {})]);
  console.log(`  kendi sesinle seslendirme ${Math.round((Date.now() - started) / 60000)} dk sürdü`);
  return job.scenes.map((_, i) => path.join(outDir, `${String(i).padStart(3, '0')}.wav`));
}

// Chatterbox kelime zamanı vermez; kelimeler konuşma süresine okunuş uzunluklarına göre dağıtılır
// ("1096" ekranda kısa ama "bin doksan altı" diye uzun okunur).
export function proportionalWords(narration, voicedSec, spokenLength = (t) => t.length) {
  const tokens = narration.trim().split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => spokenLength(t) + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return tokens.map((w, i) => {
    const d = (weights[i] / total) * voicedSec;
    const word = { t, d, w };
    t += d;
    return word;
  });
}
