// Video başına performans (YouTube Analytics, ücretsiz): ilk 7 günün izlenmesi, izlenme yüzdesi, tutma eğrisi,
// Shorts'ta "izlemeyi seçen" oranı, trafik kaynakları. Günde bir, son 90 günün videoları için çalışır.
// Veri yayından 9 gün sonra "sabit" olur ve bir daha sorgulanmaz. Sonuç perf/{youtubeId} belgelerine yazılır.
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { authFor } from '../pipeline/youtube.js';
import { DONE_DIR } from './paths.js';

const DAY = 86400000;
const PENCERE_GUN = 90;
const SABIT_GUN = 9; // 7 günlük pencere + Analytics'in 1-2 günlük gecikmesi
const EGRI_NOKTA = 20; // tutma eğrisi %5 aralıklarla saklanır

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// ISO 8601 süre (PT1M5S) → saniye
export function saniye(iso = '') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (Number(m[1] ?? 0) * 86400) + (Number(m[2] ?? 0) * 3600) + (Number(m[3] ?? 0) * 60) + Number(m[4] ?? 0) : 0;
}

// Kanalın kendi senaryoları (done/): youtubeId eşleşmesi Firestore'dan, deney kolu ve sahneler dosyadan.
export function channelDoneJobs(channelId) {
  if (!fs.existsSync(DONE_DIR)) return {};
  const jobs = {};
  for (const f of fs.readdirSync(DONE_DIR).filter((n) => n.endsWith('.json'))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(DONE_DIR, f), 'utf8'));
      if (j.channelId === channelId) jobs[j.id] = j;
    } catch { /* bozuk dosya atlanır */ }
  }
  return jobs;
}

// Tutma eğrisini 20 noktaya indirger; ratio → izleyicinin yüzde kaçı o anda hâlâ izliyor (1 = %100).
export function egriOzet(rows) {
  if (!rows?.length) return null;
  const out = [];
  for (let i = 1; i <= EGRI_NOKTA; i++) {
    const t = i / EGRI_NOKTA;
    const row = rows.reduce((best, r) => (Math.abs(r[0] - t) < Math.abs(best[0] - t) ? r : best), rows[0]);
    out.push(Math.round(row[1] * 1000) / 1000);
  }
  return out;
}

function oranda(rows, ratio) {
  if (!rows?.length) return null;
  const row = rows.reduce((best, r) => (Math.abs(r[0] - ratio) < Math.abs(best[0] - ratio) ? r : best), rows[0]);
  return Math.round(row[1] * 1000) / 1000;
}

async function sorgu(api, params) {
  const { data } = await api.reports.query({ ids: 'channel==MINE', ...params });
  return data.rows ?? [];
}

// Tek video: 7 günlük ölçüler, tutma eğrisi, trafik kaynakları (3 Analytics sorgusu).
async function videoOlcu(api, v, now) {
  const start = isoDay(v.yayin);
  const end7 = isoDay(Math.min(v.yayin.getTime() + 6 * DAY, now.getTime()));
  const today = isoDay(now);
  const filters = `video==${v.youtubeId}`;
  const [m] = await sorgu(api, {
    startDate: start, endDate: end7, filters,
    metrics: 'views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares',
  });
  const [izlenme7, secen, dakika, ortSure, tutma, abone, begeni, yorum, paylasim] = m ?? [];
  const ret = await sorgu(api, { startDate: start, endDate: today, filters, metrics: 'audienceWatchRatio', dimensions: 'elapsedVideoTimeRatio' })
    .catch(() => []);
  const trafikRows = await sorgu(api, { startDate: start, endDate: end7, filters, metrics: 'views', dimensions: 'insightTrafficSourceType' })
    .catch(() => []);
  const trafik = Object.fromEntries(trafikRows.filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6));
  return {
    izlenme7: izlenme7 ?? 0,
    izlemeSecen7: secen ?? null,
    kancaOran: izlenme7 > 0 && secen != null ? Math.round((secen / izlenme7) * 1000) / 1000 : null,
    dakika7: dakika ?? 0,
    ortSure: ortSure ?? null,
    tutma: tutma ?? null,
    abone7: abone ?? 0,
    begeni7: begeni ?? 0,
    yorum7: yorum ?? 0,
    paylasim7: paylasim ?? 0,
    egri: egriOzet(ret),
    tutma30: v.sure > 40 ? oranda(ret, 30 / v.sure) : null,
    trafik,
  };
}

// Kanalın son 90 günlük videoları (elle yüklenenler dahil).
async function sonVideolar(yt, now) {
  const ch = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items?.[0];
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];
  const { data } = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: uploads, maxResults: 50 });
  const items = (data.items ?? [])
    .map((i) => ({ youtubeId: i.contentDetails.videoId, yayin: new Date(i.contentDetails.videoPublishedAt ?? 0) }))
    .filter((i) => i.yayin.getTime() > now.getTime() - PENCERE_GUN * DAY && i.yayin.getTime() < now.getTime() - DAY);
  if (!items.length) return [];
  const details = (await yt.videos.list({ part: ['contentDetails', 'snippet', 'status'], id: items.map((i) => i.youtubeId) })).data.items ?? [];
  const byId = Object.fromEntries(details.map((d) => [d.id, d]));
  return items.filter((i) => byId[i.youtubeId]?.status?.privacyStatus === 'public').map((i) => {
    const d = byId[i.youtubeId];
    const sure = saniye(d.contentDetails.duration);
    return { ...i, baslik: d.snippet.title, sure, tip: sure <= 180 ? 'short' : 'long' };
  });
}

// Kanalın arama terimleri (son 28 gün): başlık ve etiketlerde kullanılmak üzere.
async function aramaTerimleri(api, now) {
  const rows = await sorgu(api, {
    startDate: isoDay(now.getTime() - 28 * DAY), endDate: isoDay(now), metrics: 'views',
    dimensions: 'insightTrafficSourceDetail', filters: 'insightTrafficSourceType==YT_SEARCH', sort: '-views', maxResults: 15,
  });
  return rows.map(([terim, izlenme]) => ({ terim, izlenme }));
}

// Döner: { perfs: [perf belgesi], aramalar }. Belgeler Firestore'a da yazılır.
export async function updatePerf(firestore, channelDoc, now = new Date()) {
  const secret = (await firestore.doc(`secrets/${channelDoc.id}`).get()).data();
  if (!secret?.refreshToken) return null;
  const auth = authFor(secret);
  const yt = google.youtube({ version: 'v3', auth });
  const api = google.youtubeAnalytics({ version: 'v2', auth });

  const videolar = await sonVideolar(yt, now);
  const kayitli = Object.fromEntries((await firestore.collection('perf').where('channelId', '==', channelDoc.id).get())
    .docs.map((d) => [d.id, d.data()]));
  const ourVideos = (await firestore.collection('videos').where('channelId', '==', channelDoc.id).select('youtubeId').get())
    .docs.filter((d) => d.data().youtubeId);
  const jobIdOf = Object.fromEntries(ourVideos.map((d) => [d.data().youtubeId, d.id]));
  const jobs = channelDoneJobs(channelDoc.id);

  // Toplam (ömür boyu) izlenme tek sorguda.
  const toplam = videolar.length ? Object.fromEntries(await sorgu(api, {
    startDate: isoDay(Math.min(...videolar.map((v) => v.yayin.getTime()))), endDate: isoDay(now),
    metrics: 'views', dimensions: 'video', filters: `video==${videolar.map((v) => v.youtubeId).join(',')}`,
  }).catch(() => [])) : {};

  const perfs = [];
  for (const v of videolar) {
    const eski = kayitli[v.youtubeId];
    const jobId = jobIdOf[v.youtubeId] ?? null;
    const job = jobId ? jobs[jobId] : null;
    const temel = {
      channelId: channelDoc.id, youtubeId: v.youtubeId, jobId, baslik: v.baslik, tip: v.tip, sure: v.sure, yayin: v.yayin,
      kol: job?.deney?.kol ?? null, deneyId: job?.deney?.id ?? null, izlenmeToplam: toplam[v.youtubeId] ?? eski?.izlenmeToplam ?? 0,
      // Son ölçümden (yaklaşık bir gün önce) bu yana gelen izlenme: gün sonu değerlendirmesi buna bakar.
      izlenmeArtis: eski && toplam[v.youtubeId] != null ? Math.max(0, toplam[v.youtubeId] - (eski.izlenmeToplam ?? 0)) : null,
    };
    let p;
    if (eski?.sabit) {
      p = { ...eski, ...temel, yayin: v.yayin };
    } else {
      try {
        const olcu = await videoOlcu(api, v, now);
        p = { ...(eski ?? {}), ...temel, ...olcu, sabit: now.getTime() - v.yayin.getTime() >= SABIT_GUN * DAY };
      } catch (e) {
        console.warn(`  ${v.youtubeId} ölçüleri okunamadı: ${e.message}`);
        continue;
      }
    }
    p.guncellendi = now;
    perfs.push(p);
  }
  const aramalar = await aramaTerimleri(api, now).catch((e) => {
    console.warn(`  arama terimleri okunamadı: ${e.message}`);
    return null;
  });
  return { perfs, aramalar, auth };
}

export async function savePerfs(firestore, perfs) {
  for (let i = 0; i < perfs.length; i += 400) {
    const batch = firestore.batch();
    for (const p of perfs.slice(i, i + 400)) batch.set(firestore.doc(`perf/${p.youtubeId}`), p);
    await batch.commit();
  }
}
