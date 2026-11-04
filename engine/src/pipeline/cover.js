// Shorts küçük resmi: videodan bir kare ve üstünde dev, kalın kanca yazısı (remotion/src/ShortCover.jsx).
import fs from 'node:fs';
import path from 'node:path';
import { options, pick } from '../lib/options.js';
import { probeDuration, run } from '../lib/util.js';
import { remotionStill } from './remotion.js';

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
