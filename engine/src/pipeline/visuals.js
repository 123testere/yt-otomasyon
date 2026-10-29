import path from 'node:path';
import { options, pick } from '../lib/options.js';
import { download, hashSeed, run, sleep } from '../lib/util.js';

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const POLLINATIONS_TOKEN = process.env.POLLINATIONS_TOKEN;
// Anonim Pollinations kullanımında istekler arası bekleme (hız sınırına takılmamak için).
const AI_DELAY_MS = Number(process.env.AI_DELAY_MS ?? (POLLINATIONS_TOKEN ? 3000 : 16000));

let lastAiCall = 0;

export async function aiImage(prompt, { w, h, seed }, dest) {
  const wait = lastAiCall + AI_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastAiCall = Date.now();
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    + `?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
  const headers = POLLINATIONS_TOKEN ? { Authorization: `Bearer ${POLLINATIONS_TOKEN}` } : {};
  return download(url, dest, { headers, minBytes: 10_000 });
}

async function pexels(endpoint, query, orientation) {
  if (!PEXELS_KEY) throw new Error('PEXELS_API_KEY tanımlı değil');
  const url = `https://api.pexels.com/${endpoint}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=15`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
  return res.json();
}

function freshPick(items, used, keyOf) {
  const fresh = items.filter((it) => !used.has(keyOf(it)));
  const chosen = (fresh.length ? fresh : items)[0];
  if (!chosen) throw new Error('Sonuç yok');
  used.add(keyOf(chosen));
  return chosen;
}

async function pexelsPhoto(query, fmt, dest, used) {
  const data = await pexels('v1/search', query, fmt.portrait ? 'portrait' : 'landscape');
  const photo = freshPick(data.photos ?? [], used, (p) => `p${p.id}`);
  await download(`${photo.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=${fmt.w}&h=${fmt.h}`, dest);
  return { kind: 'image', file: dest };
}

async function pexelsVideo(query, fmt, dest, used) {
  const data = await pexels('videos/search', query, fmt.portrait ? 'portrait' : 'landscape');
  const video = freshPick(data.videos ?? [], used, (v) => `v${v.id}`);
  const minSide = Math.min(fmt.w, fmt.h);
  const files = video.video_files
    .filter((f) => f.file_type === 'video/mp4' && f.width && f.height)
    .sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height));
  const file = files.find((f) => Math.min(f.width, f.height) >= minSide) ?? files.at(-1);
  if (!file) throw new Error('Uygun video dosyası yok');
  await download(file.link, dest, { timeoutMs: 300_000 });
  return { kind: 'video', file: dest };
}

async function plainBackground(fmt, dest) {
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
    `color=c=0x1b2030:s=${fmt.w}x${fmt.h}`, '-frames:v', '1', dest]);
  return { kind: 'image', file: dest };
}

// Seçilen stile göre sahne görseli bulur; olmazsa sıradaki kaynağa düşer, en sonda düz arka plan.
export async function sceneVisual(scene, i, { settings, fmt, dir, used, seedBase }) {
  const style = pick(options.visualStyles, settings.visualStyle) ?? options.visualStyles[0];
  const base = path.join(dir, `gorsel-${String(i).padStart(3, '0')}`);
  const ai = () => aiImage(`${scene.visual.prompt}, ${style.suffix ?? 'cinematic, detailed'}`,
    { ...fmt, seed: seedBase + i }, `${base}.jpg`).then((file) => ({ kind: 'image', file }));
  const photo = () => pexelsPhoto(scene.visual.query, fmt, `${base}.jpg`, used);
  const video = () => pexelsVideo(scene.visual.query, fmt, `${base}.mp4`, used);

  const chain = {
    'pexels-video': [video, photo, ai],
    'pexels-photo': [photo, ai],
    ai: [ai, photo],
  }[style.source];

  for (const attempt of chain) {
    try {
      return await attempt();
    } catch (e) {
      console.warn(`  sahne ${i + 1} görseli: ${e.message}`);
    }
  }
  return plainBackground(fmt, `${base}.png`);
}

export function seedFor(jobId) {
  return hashSeed(jobId);
}
