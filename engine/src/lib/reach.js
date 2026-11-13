// Kapak gösterimi ve tıklanma oranı (CTR): YouTube Analytics API'de yok, yalnızca YouTube Reporting API'de
// günlük CSV raporu olarak var (ücretsiz). Kanal başına bir kez rapor işi açılır; YouTube her gün bir rapor üretir
// (veri ~2 gün gecikmeli). İzin: yt-analytics.readonly (kanal bilgisayardan yeniden bağlanınca gelir).
import { google } from 'googleapis';

const RAPOR_TURU = /reach/i;
const SAKLA_GUN = 45;

export class ReachIzinYok extends Error {}

const sayi = (v) => (v === undefined || v === '' ? 0 : Number(v));

// CSV (başlık satırı + veri) → video ve gün başına { gosterim, tik }
export function reachCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines.shift()?.split(',') ?? [];
  const col = (name) => head.indexOf(name);
  const [iDate, iVideo, iImpr, iCtr] = ['date', 'video_id', 'video_thumbnail_impressions', 'video_thumbnail_impressions_ctr'].map(col);
  if ([iDate, iVideo, iImpr, iCtr].some((i) => i < 0)) throw new Error(`beklenmeyen rapor sütunları: ${head.join(',')}`);
  const out = {};
  for (const line of lines) {
    const c = line.split(',');
    const impr = sayi(c[iImpr]);
    if (!impr) continue;
    let ctr = sayi(c[iCtr]);
    if (ctr > 1) ctr /= 100; // yüzde olarak gelirse
    const day = (out[c[iVideo]] ??= {});
    const d = (day[c[iDate]] ??= [0, 0]);
    d[0] += impr;
    d[1] += impr * ctr;
  }
  return out;
}

function izinHatasi(e) {
  const status = e?.response?.status ?? e?.code;
  return status === 403 || /insufficient|permission|scope/i.test(e?.message ?? '');
}

// Rapor işini bulur ya da açar; yeni raporları indirip { youtubeId: { YYYYMMDD: [gösterim, tık] } } döner.
export async function fetchReach(auth, state = {}) {
  const rep = google.youtubereporting({ version: 'v1', auth });
  let { jobId, sonRapor } = state;
  try {
    if (!jobId) {
      const types = (await rep.reportTypes.list()).data.reportTypes ?? [];
      const type = types.find((t) => t.id === 'channel_reach_basic_a1') ?? types.find((t) => RAPOR_TURU.test(t.id));
      if (!type) throw new Error(`erişim raporu türü bulunamadı (${types.map((t) => t.id).join(', ')})`);
      const jobs = (await rep.jobs.list()).data.jobs ?? [];
      jobId = jobs.find((j) => j.reportTypeId === type.id)?.id
        ?? (await rep.jobs.create({ requestBody: { reportTypeId: type.id, name: 'otomasyon-erisim' } })).data.id;
    }
    const reports = [];
    let pageToken;
    do {
      const { data } = await rep.jobs.reports.list({ jobId, pageToken, ...(sonRapor ? { createdAfter: sonRapor } : {}) });
      reports.push(...(data.reports ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);
    const veri = {};
    for (const r of reports.sort((a, b) => a.createTime.localeCompare(b.createTime))) {
      const res = await auth.request({ url: r.downloadUrl, responseType: 'text' });
      for (const [vid, days] of Object.entries(reachCsv(res.data))) {
        const v = (veri[vid] ??= {});
        for (const [d, [i, t]] of Object.entries(days)) v[d] = [i, t]; // aynı gün yeniden gelirse sonuncusu geçerli
      }
      sonRapor = r.createTime;
    }
    return { jobId, sonRapor: sonRapor ?? null, veri };
  } catch (e) {
    if (izinHatasi(e)) throw new ReachIzinYok(e.message);
    throw e;
  }
}

const gunNo = (d) => d.replace(/-/g, '');

// perf belgesine günlük gösterim/tık verisini işler ve ilk 7 günün tıklanma oranını hesaplar.
export function reachUygula(p, gunluk, now = new Date()) {
  const birlesik = { ...(p.gunluk ?? {}), ...(gunluk ?? {}) };
  const sinir = gunNo(new Date(now.getTime() - SAKLA_GUN * 86400000).toISOString().slice(0, 10));
  for (const d of Object.keys(birlesik)) if (d < sinir) delete birlesik[d];
  const yayin = new Date(p.yayin?.toDate?.() ?? p.yayin);
  const bas = gunNo(yayin.toISOString().slice(0, 10));
  const son = gunNo(new Date(yayin.getTime() + 6 * 86400000).toISOString().slice(0, 10));
  let impr = 0;
  let tik = 0;
  for (const [d, [i, t]] of Object.entries(birlesik)) if (d >= bas && d <= son) { impr += i; tik += t; }
  const out = { ...p, gunluk: birlesik };
  if (impr > 0) {
    out.gosterim7 = Math.round(impr);
    out.tiklanma7 = Math.round((tik / impr) * 10000) / 100; // yüzde
  }
  return out;
}

// Belirli günler arasındaki tıklanma oranı (kapak denemesinde önce/sonra karşılaştırması için).
export function aralikCtr(gunluk, basGun, sonGun) {
  let impr = 0;
  let tik = 0;
  for (const [d, [i, t]] of Object.entries(gunluk ?? {})) if (d >= basGun && d <= sonGun) { impr += i; tik += t; }
  return { gosterim: Math.round(impr), ctr: impr ? Math.round((tik / impr) * 10000) / 100 : null };
}

// 3 kapak testi: sonuçlardan en yüksek tıklanmalı kapak (eşitlikte önce denenen). Ölçülemeyen (ctr null) kazanamaz.
export const enIyiKapak = (sonuclar) => sonuclar.filter((s) => typeof s.ctr === 'number')
  .reduce((en, s) => (!en || s.ctr > en.ctr ? s : en), null);
