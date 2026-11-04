// Daha önce yüklenmiş videoların küçük resimlerini yeni kanca kapağıyla değiştirir (bilgisayarda bir kez çalıştırılır).
// Kullanım: node src/kapak-yenile.js [kanalId]   — her video ~50 kota birimi harcar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { db } from './lib/firebase.js';
import { options, pick, resolveSettings } from './lib/options.js';
import { DONE_DIR } from './lib/paths.js';
import { authFor } from './pipeline/youtube.js';
import { makeShortCover } from './pipeline/cover.js';
import { wikimedia } from './pipeline/archives.js';
import { aiImage } from './pipeline/visuals.js';
import { remotionStill } from './pipeline/remotion.js';
import { run } from './lib/util.js';

const only = process.argv[2];
const firestore = db();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kapak-'));
const clients = {};

async function youtubeFor(channelId) {
  if (clients[channelId]) return clients[channelId];
  const secret = (await firestore.doc(`secrets/${channelId}`).get()).data();
  return (clients[channelId] = google.youtube({ version: 'v3', auth: authFor(secret) }));
}

async function background(job, fmt, dir) {
  const query = job.scenes?.find((s) => s.visual?.query)?.visual.query;
  if (!query) return null;
  try {
    return (await wikimedia(query, fmt, path.join(dir, 'arka.jpg'), new Set())).file;
  } catch {
    return null;
  }
}

const jobs = fs.readdirSync(DONE_DIR).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DONE_DIR, f), 'utf8')))
  .filter((j) => !only || j.channelId === only);

let ok = 0;
for (const job of jobs) {
  const video = (await firestore.doc(`videos/${job.id}`).get()).data();
  if (video?.status !== 'uploaded' || !video.youtubeId) continue;
  const settings = resolveSettings((await firestore.doc(`channels/${job.channelId}`).get()).data()?.settings);
  const dir = path.join(work, job.id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    let file;
    if (job.type === 'short') {
      const bg = job.format === 'duell' ? null : await background(job, { w: 1080, h: 1920, portrait: true }, dir);
      file = await makeShortCover({ job, settings, background: bg, dir });
    } else {
      const style = pick(options.visualStyles, settings.visualStyle);
      const bg = await aiImage(`${job.thumbnailPrompt}, ${style?.suffix ?? 'cinematic'}, eye-catching youtube thumbnail`,
        { w: 1280, h: 720, seed: 999 }, path.join(dir, 'arka.jpg')).catch(() => background(job, { w: 1280, h: 720, portrait: false }, dir));
      const accent = (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;
      const png = await remotionStill('Thumb', { background: bg, text: job.thumbnailText, badge: null, lang: settings.language, accent }, path.join(dir, 'kapak.png'), `${job.id}-kapak`);
      file = path.join(dir, 'kapak.jpg');
      await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', file]);
    }
    const yt = await youtubeFor(job.channelId);
    await yt.thumbnails.set({ videoId: video.youtubeId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(file) } });
    ok++;
    console.log(`✓ ${job.title} (https://youtu.be/${video.youtubeId})`);
  } catch (e) {
    console.log(`✗ ${job.title}: ${e.message}`);
  }
}
console.log(`${ok} küçük resim güncellendi. Dosyalar: ${work}`);
process.exit(0);
