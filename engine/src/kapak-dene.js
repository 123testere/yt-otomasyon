// 3 kapak testi (senkronizasyondan sonra, iş akışında çalışır; Remotion gerekir).
// YouTube'un kendi "Test ve karşılaştır" özelliği API'de yok; bu yüzden kapaklar sırayla denenir:
//   1) Her uzun videoda A (asıl kapak, thumbnailText) yayından beri ölçülür; sonra B (thumbnailTextAlt) ve
//      C (thumbnailTextAlt2) en az 2'şer gün yayında kalır. Tıklanma oranı en yüksek olan kapak kalır.
//   2) Kazanan kapağın tıklanması hâlâ %3'ün altındaysa yedek başlık (titleAlt) denenir; kötüyse eski başlık geri gelir.
// Durum perf/{youtubeId}.kapakDeneme alanında: bekliyor → deneniyor (asama 1: B, 2: C) → kazandi | baslik-deneniyor → kazandi | geri-alindi
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { db } from './lib/firebase.js';
import { resolveSettings } from './lib/options.js';
import { DONE_DIR, ROOT } from './lib/paths.js';
import { notify } from './lib/notify.js';
import { aralikCtr, enIyiKapak } from './lib/reach.js';
import { authFor } from './pipeline/youtube.js';
import { uzunKapak } from './pipeline/cover.js';

const DAY = 86400000;
const MIN_GUN = 2; // her kapak en az bu kadar gün yayında kalır
const MAX_GUN = 5; // gösterim az gelse de bu kadar gün sonra sıradakine geçilir
const MIN_GOSTERIM = 50;
const BASLIK_ESIK = 3; // kazanan kapağın tıklanması bunun altındaysa başlık da denenir (%)

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
      await kapakKoy(yt, p, job, settings, job.thumbnailTextAlt, 'b');
      return kaydet(p, { durum: 'deneniyor', asama: 1, baslangic: bugun, once, sonuclar: [{ ad: 'A', yazi: job.thumbnailText, ...once }] },
        `${ad}: kapak testi başladı. A “${job.thumbnailText}” tıklanma %${once.ctr ?? '?'}; şimdi B “${job.thumbnailTextAlt}” deneniyor.`);
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
    // Eski kayıtlarda (tek yedekli deneme) sonuclar yok: A = değişiklik öncesi ölçü.
    const asama = k.asama ?? 1;
    const yazilar = [job.thumbnailText, job.thumbnailTextAlt, job.thumbnailTextAlt2];
    const sonuclar = [...(k.sonuclar ?? [{ ad: 'A', yazi: job.thumbnailText, ...k.once }]), { ad: 'ABC'[asama], yazi: yazilar[asama], ...sonra }];
    if (asama === 1 && job.thumbnailTextAlt2) {
      await kapakKoy(yt, p, job, settings, job.thumbnailTextAlt2, 'c');
      return kaydet(p, { ...k, asama: 2, baslangic: bugun, sonuclar },
        `${ad}: B “${job.thumbnailTextAlt}” tıklanma %${sonra.ctr ?? '?'}; şimdi C “${job.thumbnailTextAlt2}” deneniyor.`);
    }
    const kazanan = enIyiKapak(sonuclar) ?? sonuclar[0];
    if (kazanan.ad !== 'ABC'[asama]) await kapakKoy(yt, p, job, settings, kazanan.yazi, 'kazanan');
    const ozet = sonuclar.map((s) => `${s.ad} %${s.ctr ?? '?'}`).join(', ');
    if ((kazanan.ctr ?? 0) < BASLIK_ESIK && await basligaGec({ ctr: kazanan.ctr, gosterim: kazanan.gosterim })) {
      await firestore.doc(`perf/${p.youtubeId}`).update({ 'kapakDeneme.sonuclar': sonuclar, 'kapakDeneme.kazananKapak': kazanan.ad });
      return null;
    }
    return kaydet(p, { ...k, durum: 'kazandi', sonuclar, kazanan: kazanan.ad, sonra },
      `${ad}: kapak testi bitti (${ozet}). ${kazanan.ad} “${kazanan.yazi}” kazandı ve kalıcı oldu.`);
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
// Günlük iyileştirme: Claude rutininin zayıf uzun videolar için yazdığı yeni başlık / kapak yazısı (iyilestirme/*.json).
// Dosya: [{ youtubeId, title?, thumbnailText?, kapak?: {sahne, sn}, neden }]. Uygulanınca dosya silinir (iş akışı commit eder).
const IYI_DIR = path.join(ROOT, 'iyilestirme');
const iyiDosyalar = fs.existsSync(IYI_DIR) ? fs.readdirSync(IYI_DIR).filter((f) => f.endsWith('.json')) : [];
for (const f of iyiDosyalar) {
  let liste = [];
  try { liste = JSON.parse(fs.readFileSync(path.join(IYI_DIR, f), 'utf8')); } catch (e) { console.warn(`✗ ${f}: ${e.message}`); }
  for (const x of Array.isArray(liste) ? liste : []) {
    try {
      const p = (await firestore.doc(`perf/${x.youtubeId}`).get()).data();
      if (!p) throw new Error('video ölçüsü bulunamadı');
      const job = p.jobId ? jobOf(p.jobId) : null;
      const settings = resolveSettings((await firestore.doc(`channels/${p.channelId}`).get()).data()?.settings);
      const yt = google.youtube({ version: 'v3', auth: authFor((await firestore.doc(`secrets/${p.channelId}`).get()).data()) });
      const yapilan = [];
      if (x.thumbnailText && job && p.tip === 'long') {
        await kapakKoy(yt, p, { ...job, kapak: x.kapak ?? job.kapak }, settings, x.thumbnailText, `iyilestirme-${Date.now()}`);
        yapilan.push(`kapak “${x.thumbnailText}”`);
      }
      let eskiBaslik = null;
      if (x.title && x.title.length <= 100 && !/[<>]/.test(x.title)) {
        eskiBaslik = await baslikKoy(yt, x.youtubeId, x.title);
        yapilan.push(`başlık “${x.title}”`);
      }
      if (!yapilan.length) continue;
      await firestore.doc(`perf/${x.youtubeId}`).update({
        iyilestirmeler: FieldValue.arrayUnion({ tarih: now.toISOString(), title: x.title ?? null, eskiBaslik, thumbnailText: x.thumbnailText ?? null, neden: x.neden ?? null, onceCtr: p.tiklanma7 ?? null, onceTutma: p.tutma ?? null }),
      });
      const metin = `“${p.baslik}”: ${yapilan.join(' ve ')} olarak güncellendi${x.neden ? ` (${x.neden})` : ''}.`;
      await firestore.doc(`channels/${p.channelId}`).update({ 'optimizasyon.degisiklikler': FieldValue.arrayUnion({ tarih: now.toISOString(), metin, youtubeId: x.youtubeId }) });
      await notify({ title: 'Video iyileştirildi', body: metin.slice(0, 180), channelId: p.channelId });
      console.log(`✓ iyileştirme ${x.youtubeId}: ${yapilan.join(', ')}`);
    } catch (e) {
      console.warn(`✗ iyileştirme ${x.youtubeId}: ${e.message}`);
    }
  }
  fs.rmSync(path.join(IYI_DIR, f));
}

fs.rmSync(work, { recursive: true, force: true });
process.exit(0);
