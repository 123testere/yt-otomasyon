// Yorumlara otomatik cevap (kanal ayarında "Yorumlara otomatik cevap" açıksa; varsayılan kapalı).
// 1) Senkronizasyon son 7 günün videolarındaki cevapsız yorumları config/yorumlar.json'a yazar.
// 2) Gece rutini kanal karakterinin ağzından cevapları cevaplar/<tarih>.json dosyasına yazar.
// 3) Senkronizasyon cevapları YouTube'a gönderir ve dosyayı siler (cevaplanan yorum bir daha listelenmez).
import fs from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { authFor } from '../pipeline/youtube.js';
import { ROOT } from './paths.js';

export const CEVAP_DIR = path.join(ROOT, 'cevaplar');
const PENCERE_MS = 7 * 86400000;
const KANAL_BASINA = 10;
const MAX_CEVAP = 300;

const kelime = (t) => String(t).trim().split(/\s+/).filter(Boolean).length;
// Sadece oy ("A", "b olsun") ya da 3 kelimeden kısa yorumlara cevap yazılmaz.
export const cevaplanir = (text) => kelime(text) >= 3 && !/^[([]?\s*[ab]\s*[)\].!:,-]?(\s+olsun)?\s*$/i.test(String(text).trim());

async function client(firestore, channelId, cache) {
  if (cache[channelId] !== undefined) return cache[channelId];
  const secret = (await firestore.doc(`secrets/${channelId}`).get()).data();
  cache[channelId] = secret?.refreshToken ? google.youtube({ version: 'v3', auth: authFor(secret) }) : null;
  return cache[channelId];
}

export async function collectComments(firestore, channels, now = new Date()) {
  const out = [];
  const cache = {};
  for (const c of channels.filter((ch) => ch.enabled && ch.settings.optimizasyon?.yorumCevap)) {
    const yt = await client(firestore, c.id, cache);
    if (!yt) continue;
    const videos = (await firestore.collection('videos').where('channelId', '==', c.id).where('status', '==', 'uploaded').get()).docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((v) => v.youtubeId && v.publishAt && v.publishAt.toMillis() <= now.getTime() && now.getTime() - v.publishAt.toMillis() <= PENCERE_MS);
    let kalan = KANAL_BASINA;
    for (const v of videos) {
      if (kalan <= 0) break;
      try {
        const { data } = await yt.commentThreads.list({ part: ['snippet'], videoId: v.youtubeId, maxResults: 50, order: 'time', textFormat: 'plainText' });
        const yapilan = new Set(v.cevaplanan ?? []);
        for (const t of data.items ?? []) {
          const s = t.snippet.topLevelComment.snippet;
          if (kalan <= 0) break;
          if (t.snippet.totalReplyCount > 0 || yapilan.has(t.id) || s.authorChannelId?.value === c.id || !cevaplanir(s.textDisplay)) continue;
          out.push({ channelId: c.id, videoId: v.id, videoBaslik: v.title, commentId: t.id, yazar: s.authorDisplayName, metin: s.textDisplay.slice(0, 500) });
          kalan--;
        }
      } catch (e) {
        console.warn(`${v.id} yorumları okunamadı: ${e.message}`);
      }
    }
  }
  return out;
}

// cevaplar/*.json: [{ channelId, videoId, commentId, metin }]
export async function postReplies(firestore) {
  if (!fs.existsSync(CEVAP_DIR)) return 0;
  const cache = {};
  let n = 0;
  for (const f of fs.readdirSync(CEVAP_DIR).filter((x) => x.endsWith('.json'))) {
    const file = path.join(CEVAP_DIR, f);
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn(`${f} okunamadı: ${e.message}`);
    }
    for (const r of Array.isArray(list) ? list : []) {
      const text = String(r.metin ?? '').trim();
      if (!r.commentId || !r.channelId || !text || /https?:\/\//.test(text)) continue;
      const ch = (await firestore.doc(`channels/${r.channelId}`).get()).data();
      if (!ch?.settings?.optimizasyon?.yorumCevap) continue; // bu arada kapatıldıysa gönderme
      const yt = await client(firestore, r.channelId, cache);
      if (!yt) continue;
      try {
        await yt.comments.insert({ part: ['snippet'], requestBody: { snippet: { parentId: r.commentId, textOriginal: text.slice(0, MAX_CEVAP) } } });
        if (r.videoId) await firestore.doc(`videos/${r.videoId}`).update({ cevaplanan: FieldValue.arrayUnion(r.commentId) });
        n++;
      } catch (e) {
        console.warn(`yorum cevabı gönderilemedi (${r.commentId}): ${e.message}`);
        if (/insufficient|forbidden|permission/i.test(e.message)) await firestore.doc(`channels/${r.channelId}`).update({ izinEksik: true });
      }
    }
    fs.rmSync(file);
  }
  return n;
}
