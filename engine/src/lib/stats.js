// Kanal istatistikleri: uygulamadaki 1 gün / 1 hafta / 1 ay / 1 yıl izlenme kartları için.
// - Anlık toplamlar (Data API, saatte bir, ~1 kota birimi): son 24 saatin izlenmesi bunlardan hesaplanır.
// - YouTube Analytics (6 saatte bir): günlük izlenme, izlenme süresi, abone kazancı; veriler 1-2 gün gecikmeli gelir.
// Sonuç channels/{id}.istatistik alanına yazılır (uygulama okur).
import { google } from 'googleapis';
import { authFor } from '../pipeline/youtube.js';

const HOUR = 60 * 60 * 1000;
const ANALYTICS_EVERY_MS = 6 * HOUR;
const SNAPSHOT_KEEP = 30; // saatlik anlık toplamlar (~1 gün + pay)

const isoDay = (d) => d.toISOString().slice(0, 10);

function sumLast(rows, days, lastDay) {
  const from = isoDay(new Date(Date.parse(lastDay) - (days - 1) * 24 * HOUR));
  return rows.filter((r) => r.gun >= from).reduce((acc, r) => ({
    izlenme: acc.izlenme + r.izlenme, dakika: acc.dakika + r.dakika, abone: acc.abone + r.abone,
  }), { izlenme: 0, dakika: 0, abone: 0 });
}

async function analytics(auth, yt, now) {
  const api = google.youtubeAnalytics({ version: 'v2', auth });
  const end = isoDay(now);
  const start = isoDay(new Date(now.getTime() - 366 * 24 * HOUR));
  const { data } = await api.reports.query({
    ids: 'channel==MINE', startDate: start, endDate: end,
    metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost', dimensions: 'day', sort: 'day',
  });
  const rows = (data.rows ?? []).map(([gun, izlenme, dakika, kazanc, kayip]) => ({ gun, izlenme, dakika, abone: kazanc - kayip }));
  const lastDay = rows.at(-1)?.gun ?? end;
  const top = await api.reports.query({
    ids: 'channel==MINE', startDate: isoDay(new Date(now.getTime() - 30 * 24 * HOUR)), endDate: end,
    metrics: 'views', dimensions: 'video', sort: '-views', maxResults: 5,
  });
  const ids = (top.data.rows ?? []).map(([id]) => id);
  const titles = ids.length
    ? Object.fromEntries(((await yt.videos.list({ part: ['snippet'], id: ids })).data.items ?? []).map((v) => [v.id, v.snippet.title]))
    : {};
  return {
    sonGun: lastDay,
    gunluk: sumLast(rows, 1, lastDay),
    haftalik: sumLast(rows, 7, lastDay),
    aylik: sumLast(rows, 30, lastDay),
    yillik: sumLast(rows, 365, lastDay),
    grafik: rows.slice(-30).map((r) => ({ gun: r.gun, izlenme: r.izlenme })),
    enIyi: (top.data.rows ?? []).map(([id, izlenme]) => ({ youtubeId: id, baslik: titles[id] ?? id, izlenme })),
    analizAt: now,
    analizHata: null,
  };
}

export async function updateStats(firestore, doc, now = new Date()) {
  const secret = (await firestore.doc(`secrets/${doc.id}`).get()).data();
  if (!secret?.refreshToken) return;
  const prev = doc.data().istatistik ?? {};
  const auth = authFor(secret);
  const yt = google.youtube({ version: 'v3', auth });
  const next = { ...prev };
  try {
    const ch = (await yt.channels.list({ part: ['statistics'], mine: true })).data.items?.[0]?.statistics;
    if (ch) {
      next.toplam = { izlenme: Number(ch.viewCount), abone: Number(ch.subscriberCount), video: Number(ch.videoCount) };
      const snaps = [...(prev.anlik ?? []), { at: now.getTime(), izlenme: Number(ch.viewCount) }].slice(-SNAPSHOT_KEEP);
      next.anlik = snaps;
      // Son 24 saat: 24 saat (ya da en eski) önceki toplamdan bu yana.
      const base = snaps.find((s) => s.at >= now.getTime() - 25 * HOUR) ?? snaps[0];
      next.son24 = { izlenme: Math.max(0, Number(ch.viewCount) - base.izlenme), saat: Math.round((now.getTime() - base.at) / HOUR) };
    }
  } catch (e) {
    console.warn(`${doc.id} kanal toplamları okunamadı: ${e.message}`);
  }
  if (!prev.analizAt?.toMillis || prev.analizAt.toMillis() < now.getTime() - ANALYTICS_EVERY_MS) {
    try {
      Object.assign(next, await analytics(auth, yt, now));
    } catch (e) {
      // analizAt güncellenmez: API açılınca bir sonraki saatte yeniden denenir.
      next.analizHata = e.message.slice(0, 300);
      console.warn(`${doc.id} YouTube Analytics: ${e.message}`);
    }
  }
  next.guncellendi = now;
  await doc.ref.update({ istatistik: next });
}
