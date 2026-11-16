import fs from 'node:fs/promises';
import { enAzTempo } from '../lib/hizli.js';
import path from 'node:path';
import { PY_DIR } from '../lib/paths.js';
import { probeDuration, retry, run } from '../lib/util.js';
import { cloneNarrate, proportionalWords, voiceInScope } from './clone.js';
import { elevenScene } from './elevenlabs.js';
import { spellNumbersTr } from '../lib/numbers-tr.js';
import { voiceStyleOf } from '../lib/options.js';

const SCENE_GAP_SEC = 0.35;
const PYTHON = process.env.PYTHON ?? 'python3';

// Seslendirme motorlarına gidecek metin; Türkçede rakamlar okunuşlarına çevrilir.
export const spokenText = (text, language) => (language === 'tr' ? spellNumbersTr(text) : text);

async function edgeScene(text, settings, base) {
  await fs.writeFile(`${base}.txt`, text);
  await retry(
    () => run(PYTHON, [path.join(PY_DIR, 'tts.py'), `${base}.txt`, settings.voice, settings.speechRate,
      `${base}.mp3`, `${base}.json`, settings.voicePitch ?? '+0Hz']),
    { label: 'seslendirme', tries: 5, delayMs: 15000 },
  );
  return { raw: `${base}.mp3`, words: JSON.parse(await fs.readFile(`${base}.json`, 'utf8')) };
}

const sceneBase = (dir, i) => path.join(dir, `ses-${String(i).padStart(3, '0')}`);

// Seslendirme rakamları okunuşuyla okur ("333" → "üç yüz otuz üç"); altyazıda tekrar tek kelime "333" olarak
// görünsün diye okunuş kelimeleri metindeki orijinal kelimeye geri toplanır. Sayılar tutmazsa olduğu gibi bırakılır.
function regroupSpokenNumbers(narration, words, language) {
  if (language !== 'tr' || !words?.length || !/\d/.test(narration)) return words;
  const tokens = narration.trim().split(/\s+/);
  const counts = tokens.map((t) => spokenText(t, language).split(/\s+/).filter(Boolean).length);
  if (counts.reduce((a, b) => a + b, 0) !== words.length) return words;
  let k = 0;
  return tokens.map((token, i) => {
    const part = words.slice(k, (k += counts[i]));
    const last = part.at(-1);
    return { t: part[0].t, d: last.t + last.d - part[0].t, w: token };
  });
}

// Kanalın seçtiği kendi ses kaynağıyla bütün sahneleri seslendirir. Biri bile başarısız olursa null döner;
// o zaman video baştan sona hazır sesle okunur (aynı videoda iki farklı ses olmasın).
async function ownVoice(job, settings, dir, tempo) {
  if (!voiceInScope(settings, job.type)) return null;
  try {
    if (settings.voiceSource === 'elevenlabs') {
      const voiceId = settings.elevenVoiceId?.trim() || process.env.ELEVENLABS_VOICE_ID;
      const scenes = [];
      const voiceSettings = voiceStyleOf(settings).elevenlabs;
      for (const [i, scene] of job.scenes.entries()) {
        const text = spokenText(scene.narration.trim(), settings.language);
        const cacheFile = `${sceneBase(dir, i)}-el.json`;
        const key = JSON.stringify({ text, voiceId, tempo, voiceSettings });
        // Aynı metin aynı ayarlarla zaten seslendirildiyse (yeniden render) kredi harcama.
        const cached = await fs.readFile(cacheFile, 'utf8').then(JSON.parse).catch(() => null);
        if (cached?.key === key) {
          scenes.push(cached.result);
          continue;
        }
        const result = await retry(
          () => elevenScene(text, { voiceId, speed: tempo, voiceSettings }, `${sceneBase(dir, i)}-el.mp3`),
          { label: `ElevenLabs sahne ${i + 1}`, tries: 2, delayMs: 5000 },
        );
        await fs.writeFile(cacheFile, JSON.stringify({ key, result }));
        scenes.push(result);
      }
      return { scenes, retime: false };
    }
    if (settings.voiceSource === 'klon') {
      const files = await cloneNarrate(job, settings, dir);
      // Chatterbox hız ayarı desteklemez; kanalın konuşma hızı sonradan uygulanır.
      return { scenes: files.map((raw) => ({ raw, words: null })), retime: true };
    }
  } catch (e) {
    console.warn(`  kendi sesinle seslendirme başarısız, hazır sese geçiliyor: ${e.message}`);
  }
  return null;
}

// Her sahne ayrı seslendirilir; böylece sahne süreleri ve kelime zamanları kesin bilinir.
export async function narrate(job, settings, dir) {
  // Shorts'a ayrı konuşma hızı seçilmişse o kullanılır.
  // Hızlı konuşma kuralı: Shorts'ta en az +20%, uzun videoda en az +12% (kanal daha hızlısını seçtiyse o geçerli).
  {
    const secili = (job.type === 'short' ? settings.shorts?.speechRate : null) ?? settings.speechRate ?? '+0%';
    const taban = Math.round((enAzTempo(job.type) - 1) * 100);
    settings = { ...settings, speechRate: parseInt(secili, 10) >= taban ? secili : `+${taban}%` };
  }
  const tempo = 1 + parseInt(settings.speechRate, 10) / 100;
  const own = await ownVoice(job, settings, dir, tempo);

  const results = [];
  let offset = 0;
  for (const [i, scene] of job.scenes.entries()) {
    const base = sceneBase(dir, i);
    const { raw, words } = own?.scenes[i] ?? await edgeScene(spokenText(scene.narration.trim(), settings.language), settings, base);

    const filters = [own?.retime && tempo !== 1 ? `atempo=${tempo}` : null, `apad=pad_dur=${SCENE_GAP_SEC}`].filter(Boolean);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', filters.join(','), '-ar', '48000', '-ac', '2', `${base}.wav`]);
    const duration = await probeDuration(`${base}.wav`);
    const sceneWords = words
      ? regroupSpokenNumbers(scene.narration, words, settings.language)
      : proportionalWords(scene.narration, Math.max(0.5, duration - SCENE_GAP_SEC), (token) => spokenText(token, settings.language).length);
    results.push({ wav: `${base}.wav`, start: offset, duration, words: sceneWords.map((w) => ({ ...w, t: w.t + offset })) });
    offset += duration;
  }

  const list = path.join(dir, 'ses-liste.txt');
  await fs.writeFile(list, results.map((r) => `file '${path.basename(r.wav)}'`).join('\n'));
  const narration = path.join(dir, 'anlatim.wav');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', narration]);
  return { scenes: results, narration, total: offset, voice: own ? settings.voiceSource : 'hazir' };
}
