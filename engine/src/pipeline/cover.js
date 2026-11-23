// Shorts küçük resmi: videodan bir kare ve üstünde dev, kalın kanca yazısı (remotion/src/ShortCover.jsx).
import fs from 'node:fs';
import path from 'node:path';
import { options, pick } from '../lib/options.js';
import { probeDuration, run } from '../lib/util.js';
import { encyclopediaThumbnail, kapakJpeg, remotionStill } from './remotion.js';
import { v4Kanal } from '../lib/master-v4.js';
import { aiImage } from './visuals.js';
import { wikimedia } from './archives.js';
import { diziKapak } from './build-dizi.js';

// Uzun video küçük resmini istenen yazıyla yeniden çizer (kapak denemesi ve geri alma için).
// Aynı tohumla aynı arka plan gelir; sadece yazı değişir.
export async function uzunKapak({ job, settings, dir, text }) {
  fs.mkdirSync(dir, { recursive: true });
  if (job.format === 'dizi') return diziKapak({ job, dir, text });
  if (job.format === 'cizim') return encyclopediaThumbnail({ job: { ...job, thumbnailText: text }, settings, dir });
  const style = pick(options.visualStyles, settings.visualStyle);
  let bg = null;
  try {
    bg = await aiImage(`${job.thumbnailPrompt}, ${style?.suffix ?? 'cinematic'}, eye-catching youtube thumbnail`,
      { w: 1280, h: 720, seed: 999 }, path.join(dir, 'arka.jpg'));
  } catch {
    const query = job.scenes?.find((s) => s.visual?.query)?.visual.query;
    if (query) bg = (await wikimedia(query, { w: 1280, h: 720, portrait: false }, path.join(dir, 'arka.jpg'), new Set()).catch(() => null))?.file ?? null;
  }
  const accent = (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;
  const png = await remotionStill('Thumb', { background: bg, text, badge: null, lang: settings.language, accent }, path.join(dir, 'kapak.png'), `${job.id}-deneme`);
  const jpg = path.join(dir, 'kapak.jpg');
  await kapakJpeg(png, jpg, { v4: v4Kanal(job.channelId) });
  return jpg;
}

// Kapakta yazacak kanca: Flaggenduell'de soru + maç rozeti, çizim formatında başlık kartı, diğerlerinde kanca yazısı.
export function coverText(job) {
  if (job.format === 'duell') {
    const badge = job.title.match(/^Duell \d+\/\d+/)?.[0]?.toUpperCase() ?? null;
    const text = job.title.replace(/^Duell \d+\/\d+:\s*/, '').replace(/SAISONFINALE\s*[–-]\s*/i, '').replace(/\p{Extended_Pictographic}/gu, '').trim();
    return { text, badge };
  }
  if (Array.isArray(job.baslikKart)) return { text: job.baslikKart.join(' '), badge: null };
  return { text: job.hookText?.trim() || job.title, badge: null };
}

export async function makeShortCover({ job, settings, background, dir }) {
  const { text, badge } = coverText(job);
  const theme = pick(options.visualStyles, settings.visualStyle)?.theme ?? null;
  const accent = (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;
  const png = path.join(dir, 'shorts-kapak.png');
  // Lamba Altında: video karesi yerine temiz gece zemini ve Nur Bey (kart ve altyazı yazının arkasında karışıyor).
  await remotionStill('ShortCover', { background: theme ? null : background, text, badge, lang: settings.language, accent, theme }, png, `${job.id}-skapak`);
  const jpg = path.join(dir, 'shorts-kapak.jpg');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '4', jpg]);
  return jpg;
}

// Videonun üçte birinden bir kare (kanca yazısı geçmiş, sahne oturmuş olur).
export async function frameFromVideo(videoPath, dest) {
  const at = Math.min(8, (await probeDuration(videoPath)) * 0.3);
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', at.toFixed(2), '-i', videoPath, '-frames:v', '1', '-q:v', '3', dest]);
  return fs.existsSync(dest) ? dest : null;
}
