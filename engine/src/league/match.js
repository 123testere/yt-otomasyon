// Bir "Ülkeler Ligi" maçını hazırlar ve Remotion ile render eder.
// Sayılar her zaman resmî kaynaktan gelir; anlatım metni sadece bu sayıları kullanır.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.js';
import { run } from '../lib/util.js';
import { narrate } from '../pipeline/tts.js';
import { alignWords } from '../pipeline/subtitles.js';
import { faoProduction } from './fao.js';

const FPS = 30;
const REMOTION = path.join(ROOT, 'remotion');
const POINTS = [10, 7, 5, 4, 3, 2, 1];
export const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'countries.json'), 'utf8'));

// FAO verisini 195 ülkeye oturtur: değeri olanlar sıralanır, olmayanlar "veri yok".
export async function faoStandings(itemCode) {
  const data = await faoProduction(itemCode);
  const ranked = countries
    .map((c) => ({ ...c, value: data.values.get(c.m49) ?? 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const has = new Set(ranked.map((c) => c.iso2));
  return {
    ...data,
    ranked,
    noData: countries.filter((c) => !has.has(c.iso2)).map((c) => c.iso2),
  };
}

const PHASE_ORDER = ['intro', 'nodata', 'rounds', 'top10', 'final', 'winner', 'why', 'table'];

export async function renderMatch({ id, topic, standings, script, settings, music, out, brand = 'ÜLKELER LİGİ', season = 1, match = 1 }) {
  const dir = path.join(path.dirname(out), id);
  fs.mkdirSync(dir, { recursive: true });

  // Her bölüm ayrı seslendirilir; bölüm süreleri sahne sürelerini belirler.
  const job = { id, type: 'short', channelId: settings.channelId, scenes: PHASE_ORDER.map((p) => ({ narration: script[p] })) };
  const narrated = await narrate(job, settings, dir);

  const pub = path.join(REMOTION, 'public', id);
  fs.mkdirSync(path.join(pub, 'flags'), { recursive: true });
  const flagSrc = path.join(REMOTION, 'node_modules', 'flag-icons', 'flags', '1x1');
  for (const c of countries) fs.copyFileSync(path.join(flagSrc, `${c.iso2}.svg`), path.join(pub, 'flags', `${c.iso2}.svg`));
  fs.copyFileSync(narrated.narration, path.join(pub, 'anlatim.wav'));
  if (music) fs.copyFileSync(music, path.join(pub, 'muzik.mp3'));

  try {
    const phases = PHASE_ORDER.map((type, i) => {
      const s = narrated.scenes[i];
      const from = Math.round(s.start * FPS);
      return { type, from, duration: Math.max(1, Math.round((s.start + s.duration) * FPS) - from) };
    });
    const words = narrated.scenes.flatMap((s, i) => alignWords(job.scenes[i].narration, s.words)).map(({ t, d, text }) => ({ t, d, text }));
    const table = standings.ranked.slice(0, POINTS.length).map((c, i) => ({ iso2: c.iso2, name: c.name, points: POINTS[i] }));
    const props = {
      fps: FPS, width: 1080, height: 1920, durationInFrames: Math.round(narrated.total * FPS),
      lang: 'tr', brand, match, phases, words,
      flags: `${id}/flags`, narration: `${id}/anlatim.wav`, music: music ? `${id}/muzik.mp3` : null, musicVolume: 0.1,
      data: {
        question: topic.question, emoji: topic.emoji, unit: topic.unit, why: topic.why ?? [], season, table,
        ranked: standings.ranked.map(({ iso2, name, value }) => ({ iso2, name, value })),
        noData: standings.noData,
        all: countries.map(({ iso2, name }) => ({ iso2, name })),
      },
    };
    const propsFile = path.join(dir, 'props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    await run('npx', ['remotion', 'render', 'src/index.jsx', 'League', out, `--props=${propsFile}`, '--codec=h264', '--crf=20', '--log=error'],
      { cwd: REMOTION, shell: process.platform === 'win32' });
    return { out, duration: narrated.total, voice: narrated.voice };
  } finally {
    fs.rmSync(pub, { recursive: true, force: true });
  }
}
