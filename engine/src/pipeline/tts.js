import fs from 'node:fs/promises';
import path from 'node:path';
import { PY_DIR } from '../lib/paths.js';
import { probeDuration, retry, run } from '../lib/util.js';
import { cloneNarrate, proportionalWords, useClone } from './clone.js';
import { spellNumbersTr } from '../lib/numbers-tr.js';

// Seslendirme motorlarına gidecek metin; Türkçede rakamlar okunuşlarına çevrilir.
export const spokenText = (text, language) => (language === 'tr' ? spellNumbersTr(text) : text);

const SCENE_GAP_SEC = 0.35;
const PYTHON = process.env.PYTHON ?? 'python3';

async function edgeScene(text, settings, base) {
  await fs.writeFile(`${base}.txt`, text);
  await retry(
    () => run(PYTHON, [path.join(PY_DIR, 'tts.py'), `${base}.txt`, settings.voice, settings.speechRate, `${base}.mp3`, `${base}.json`]),
    { label: 'seslendirme', delayMs: 5000 },
  );
  return { raw: `${base}.mp3`, words: JSON.parse(await fs.readFile(`${base}.json`, 'utf8')) };
}

// Her sahneyi ayrı seslendirir; böylece sahne süreleri ve kelime zamanları kesin bilinir.
// Kanal "kendi sesim" seçtiyse Chatterbox, aksi halde (veya o başarısız olursa) hazır ses kullanılır.
export async function narrate(job, settings, dir) {
  let cloned = null;
  if (useClone(settings, job.type)) {
    try {
      cloned = await cloneNarrate(job, settings, dir);
    } catch (e) {
      console.warn(`  kendi sesinle seslendirme başarısız, hazır sese geçiliyor: ${e.message}`);
    }
  }
  // Chatterbox hız ayarı desteklemez; kanalın konuşma hızı sonradan uygulanır.
  const tempo = 1 + parseInt(settings.speechRate, 10) / 100;

  const results = [];
  let offset = 0;
  for (const [i, scene] of job.scenes.entries()) {
    const base = path.join(dir, `ses-${String(i).padStart(3, '0')}`);
    const { raw, words } = cloned
      ? { raw: cloned[i], words: null }
      : await edgeScene(spokenText(scene.narration.trim(), settings.language), settings, base);

    const filters = [cloned && tempo !== 1 ? `atempo=${tempo}` : null, `apad=pad_dur=${SCENE_GAP_SEC}`].filter(Boolean);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', filters.join(','), '-ar', '48000', '-ac', '2', `${base}.wav`]);
    const duration = await probeDuration(`${base}.wav`);
    const sceneWords = words ?? proportionalWords(scene.narration, Math.max(0.5, duration - SCENE_GAP_SEC),
      (token) => spokenText(token, settings.language).length);
    results.push({ wav: `${base}.wav`, start: offset, duration, words: sceneWords.map((w) => ({ ...w, t: w.t + offset })) });
    offset += duration;
  }

  const list = path.join(dir, 'ses-liste.txt');
  await fs.writeFile(list, results.map((r) => `file '${path.basename(r.wav)}'`).join('\n'));
  const narration = path.join(dir, 'anlatim.wav');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', narration]);
  return { scenes: results, narration, total: offset, cloned: Boolean(cloned) };
}
