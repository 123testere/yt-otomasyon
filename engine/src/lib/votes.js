// Yorum oylaması: Shorts sonundaki "Sırada hangisi olsun? A / B" kartına izleyicilerin yorumla verdiği oylar.
// Senkronizasyon (saatte bir) son 4 günün oylamalarını sayar; kazanan konu planlayıcıyla sıradaki videoya verilir.
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { oauthClient } from '../pipeline/youtube.js';
import { DONE_DIR } from './paths.js';

const WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

const norm = (s) => String(s ?? '').toLocaleLowerCase('tr').normalize('NFC');

// Yorumdan oy: "A", "a)", "B!", "B olsun" ya da seçeneğin adı geçiyorsa. İkisi birden geçiyorsa oy sayılmaz.
export function voteOf(text, a, b) {
  const t = norm(text).trim();
  const letter = t.match(/^[([]?\s*([ab])\s*[)\].!:,-]?(\s|$)/);
  if (letter) return letter[1];
  const hasA = norm(a).length > 1 && t.includes(norm(a));
  const hasB = norm(b).length > 1 && t.includes(norm(b));
  if (hasA !== hasB) return hasA ? 'a' : 'b';
  return null;
}

// Her izleyicinin son oyu geçerli (en yeni yorum önce gelir).
export function tally(comments, a, b) {
  const seen = new Set();
  const count = { a: 0, b: 0 };
  for (const c of comments) {
    if (seen.has(c.author)) continue;
    const v = voteOf(c.text, a, b);
    if (!v) continue;
    seen.add(c.author);
    count[v]++;
  }
  return count;
}

function pollJobs(now) {
  if (!fs.existsSync(DONE_DIR)) return [];
  return fs.readdirSync(DONE_DIR).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try {
      const job = JSON.parse(fs.readFileSync(path.join(DONE_DIR, f), 'utf8'));
      const at = Date.parse(job.publishAt);
      return job.kapanis?.a && job.kapanis?.b && at <= now.getTime() && now.getTime() - at <= WINDOW_MS ? [job] : [];
    } catch {
      return [];
    }
  });
}

// Kanal başına yayınlanmış oylamalar ve güncel oy sayıları: { kanalId: [{ kaynak, baslik, a, b, oyA, oyB, yayin }] }.
export async function countVotes(firestore, now = new Date()) {
  const result = {};
  const clients = {};
  for (const job of pollJobs(now)) {
    try {
      const video = (await firestore.doc(`videos/${job.id}`).get()).data();
      if (video?.status !== 'uploaded' || !video.youtubeId) continue;
      if (!clients[job.channelId]) {
        const secret = (await firestore.doc(`secrets/${job.channelId}`).get()).data();
        if (!secret?.refreshToken) continue;
        const auth = oauthClient();
        auth.setCredentials({ refresh_token: secret.refreshToken });
        clients[job.channelId] = google.youtube({ version: 'v3', auth });
      }
      const { data } = await clients[job.channelId].commentThreads.list({
        part: ['snippet'], videoId: video.youtubeId, maxResults: 100, order: 'time', textFormat: 'plainText',
      });
      const comments = (data.items ?? []).map((it) => it.snippet.topLevelComment.snippet)
        .map((s) => ({ author: s.authorChannelId?.value ?? s.authorDisplayName, text: s.textDisplay }));
      const { a, b } = tally(comments, job.kapanis.a, job.kapanis.b);
      await firestore.doc(`videos/${job.id}`).update({ oylama: { a: job.kapanis.a, b: job.kapanis.b, oyA: a, oyB: b, sayildi: now } });
      (result[job.channelId] ??= []).push({
        kaynak: job.id, baslik: job.title, a: job.kapanis.a, b: job.kapanis.b, oyA: a, oyB: b, yayin: job.publishAt,
      });
    } catch (e) {
      console.warn(`${job.id} oyları sayılamadı: ${e.message}`);
    }
  }
  return result;
}
