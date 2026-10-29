import fs from 'node:fs/promises';
import path from 'node:path';
import { PY_DIR } from '../lib/paths.js';
import { probeDuration, retry, run } from '../lib/util.js';

const SCENE_GAP_SEC = 0.35;
const PYTHON = process.env.PYTHON ?? 'python3';

// Her sahneyi ayrı seslendirir; böylece sahne süreleri ve kelime zamanları kesin bilinir.
export async function narrate(scenes, settings, dir) {
  const results = [];
  let offset = 0;
  for (const [i, scene] of scenes.entries()) {
    const base = path.join(dir, `ses-${String(i).padStart(3, '0')}`);
    await fs.writeFile(`${base}.txt`, scene.narration.trim());
    await retry(
      () => run(PYTHON, [path.join(PY_DIR, 'tts.py'), `${base}.txt`, settings.voice, settings.speechRate, `${base}.mp3`, `${base}.json`]),
      { label: `seslendirme ${i + 1}`, delayMs: 5000 },
    );
    // Sahne arası kısa sessizlik ekleyip sabit formatta WAV'a çevir (birleştirmede kayma olmasın).
    await run('ffmpeg', ['-y', '-v', 'error', '-i', `${base}.mp3`, '-af', `apad=pad_dur=${SCENE_GAP_SEC}`,
      '-ar', '48000', '-ac', '2', `${base}.wav`]);
    const duration = await probeDuration(`${base}.wav`);
    const words = JSON.parse(await fs.readFile(`${base}.json`, 'utf8'))
      .map((w) => ({ ...w, t: w.t + offset }));
    results.push({ wav: `${base}.wav`, start: offset, duration, words });
    offset += duration;
  }

  const list = path.join(dir, 'ses-liste.txt');
  await fs.writeFile(list, results.map((r) => `file '${path.basename(r.wav)}'`).join('\n'));
  const narration = path.join(dir, 'anlatim.wav');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', narration]);
  return { scenes: results, narration, total: offset };
}
