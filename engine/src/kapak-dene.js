// Zayıf kapak denemesi (senkronizasyondan sonra, iş akışında çalışır; Remotion gerekir).
// Tıklanma oranı kanal ortalamasının çok altında kalan uzun videoda:
//   1) kapak yedek yazıyla (thumbnailTextAlt) değiştirilir; 3+ gün sonra önceki ve sonraki tıklanma karşılaştırılır.
//   2) kötüyse eski kapak geri konur ve yedek başlık (titleAlt) denenir; o da kötüyse eski başlık geri gelir.
// Durum perf/{youtubeId}.kapakDeneme alanında: bekliyor → deneniyor → kazandi | baslik-deneniyor → kazandi | geri-alindi
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { db } from './lib/firebase.js';
import { resolveSettings } from './lib/options.js';
import { DONE_DIR } from './lib/paths.js';
import { notify } from './lib/notify.js';
import { aralikCtr } from './lib/reach.js';
import { authFor } from './pipeline/youtube.js';
import { uzunKapak } from './pipeline/cover.js';

const DAY = 86400000;
const MIN_GUN = 4;
const MAX_GUN = 14;
const MIN_GOSTERIM = 200;

const gunNo = (d) => new Date(d).toISOString().slice(0, 10).replace(/-/g, '');
const gunFarki = (a, b) => (Date.parse(`${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6)}`) - Date.parse(`${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6)}`)) / DAY;

const firestore = db();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kapak-dene-'));
const now = new Date();
const bugun = gunNo(now);

function jobOf(jobId) {
  const file = path.join(DONE_DIR, `${jobId}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

async function kapakKoy(yt, p, job, settings, text, ad) {
  const file = await uzunKapak({ job, settings, dir: path.join(work, `${p.youtubeId}-${ad}`), text });
  await yt.thumbnails.set({ videoId: p.youtubeId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(file) } });
}

async function baslikKoy(yt, videoId, title) {
  const v = (await yt.videos.list({ part: ['snippet'], id: [videoId] })).data.items?.[0];
  if (!v) throw new Error('video bulunamadı');
  const s = v.snippet;
  await yt.videos.update({
    part: ['snippet'],
    requestBody: { id: videoId, snippet: { title, description: s.description, tags: s.tags, categoryId: s.categoryId, defaultLanguage: s.defaultLanguage, defaultAudioLanguage: s.defaultAudioLanguage } },
  });
  return s.title;
}

async function kaydet(p, kapakDeneme, metin) {
  await firestore.doc(`perf/${p.youtubeId}`).update({ kapakDeneme });
  if (metin) {
    await firestore.doc(`channels/${p.channelId}`).update({
      'optimizasyon.degisiklikler': FieldValue.arrayUnion({ tarih: now.toISOString(), metin, youtubeId: p.youtubeId }),
    });
    await notify({ title: 'Optimizasyon', body: metin, channelId: p.channelId });
  }
  console.log(`${p.youtubeId}: ${kapakDeneme.durum}${metin ? ` — ${metin}` : ''}`);
}

async function isle(p) {
  const k = p.kapakDeneme;
  const job = p.jobId ? jobOf(p.jobId) : null;
  if (!job) return kaydet(p, { ...k, durum: 'atlandi', neden: 'senaryo bulunamadı' });
  const ch = (await firestore.doc(`channels/${p.channelId}`).get()).data();
  const settings = resolveSettings(ch?.settings);
  const opt = settings.optimizasyon;
  const secret = (await firestore.doc(`secrets/${p.channelId}`).get()).data();
  const yt = google.youtube({ version: 'v3', auth: authFor(secret) });
  const ad = `“${p.baslik}”`;
  const yayinGun = gunNo(p.yayin.toDate());

  const basligaGec = async (once) => {
    if (!(opt.baslikDegistir && job.titleAlt)) return false;
    const eskiBaslik = await baslikKoy(yt, p.youtubeId, job.titleAlt);
    await kaydet(p, { durum: 'baslik-deneniyor', baslangic: bugun, once, eskiBaslik },
      `${ad}: tıklanma düşük, başlık “${job.titleAlt}” olarak değiştirildi.`);
    return true;
  };

  if (k.durum === 'bekliyor') {
    const once = aralikCtr(p.gunluk, yayinGun, bugun);
    if (opt.kapakDegistir && job.thumbnailTextAlt) {
      await kapakKoy(yt, p, job, settings, job.thumbnailTextAlt, 'yedek');
      return kaydet(p, { durum: 'deneniyor', baslangic: bugun, once },
        `${ad}: tıklanma %${once.ctr} ile kanal ortalamasının altında; kapak “${job.thumbnailTextAlt}” yazısıyla değiştirildi.`);
    }
    if (await basligaGec(once)) return null;
    return kaydet(p, { ...k, durum: 'atlandi', neden: 'yedek kapak ya da başlık yok' });
  }

  const gun = gunFarki(k.baslangic, bugun);
  if (gun < MIN_GUN) return null;
  // Değişiklik günü karışık olduğu için ertesi günden itibaren sayılır.
  const sonra = aralikCtr(p.gunluk, gunNo(Date.parse(`${k.baslangic.slice(0, 4)}-${k.baslangic.slice(4, 6)}-${k.baslangic.slice(6)}`) + DAY), bugun);
  if (sonra.gosterim < MIN_GOSTERIM && gun < MAX_GUN) return null;
  const iyi = sonra.ctr != null && k.once?.ctr != null && sonra.ctr >= k.once.ctr;

  if (k.durum === 'deneniyor') {
    if (iyi) return kaydet(p, { ...k, durum: 'kazandi', sonra }, `${ad}: yeni kapak tuttu (tıklanma %${k.once.ctr} → %${sonra.ctr}).`);
    await kapakKoy(yt, p, job, settings, job.thumbnailText, 'asil');
    if (await basligaGec(k.once)) return null;
    return kaydet(p, { ...k, durum: 'geri-alindi', sonra }, `${ad}: yeni kapak tutmadı (%${k.once.ctr} → %${sonra.ctr ?? '?'}), eski kapak geri kondu.`);
  }
  if (k.durum === 'baslik-deneniyor') {
    if (iyi) return kaydet(p, { ...k, durum: 'kazandi', sonra }, `${ad}: yeni başlık tuttu (tıklanma %${k.once.ctr} → %${sonra.ctr}).`);
    await baslikKoy(yt, p.youtubeId, k.eskiBaslik);
    return kaydet(p, { ...k, durum: 'geri-alindi', sonra }, `${ad}: yeni başlık tutmadı, eski başlık “${k.eskiBaslik}” geri kondu.`);
  }
  return null;
}

const snap = await firestore.collection('perf').where('kapakDeneme.durum', 'in', ['bekliyor', 'deneniyor', 'baslik-deneniyor']).get();
console.log(`${snap.size} kapak denemesi işleniyor.`);
for (const d of snap.docs) {
  const p = d.data();
  try {
    await isle(p);
  } catch (e) {
    const izin = /insufficient|forbidden|permission/i.test(e.message);
    console.warn(`✗ ${p.youtubeId}: ${e.message}`);
    await firestore.doc(`perf/${p.youtubeId}`).update({ 'kapakDeneme.hata': e.message.slice(0, 200), ...(izin ? { 'kapakDeneme.durum': 'izin-yok' } : {}) });
    if (izin) await firestore.doc(`channels/${p.channelId}`).update({ izinEksik: true });
  }
}
fs.rmSync(work, { recursive: true, force: true });
process.exit(0);
