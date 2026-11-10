// Rakip analizi: bizimle aynı işi yapan ve bizden başarılı kanalları bulur, son videolarından kendi
// ortalamalarının en az 3 katı izlenen "patlayan" videoları çıkarır. Sonuç config/rakipler/<kanal>.json
// (+ kapakların tek görselde birleşimi <kanal>.jpg); Claude rutini inceleyip analiz/rakip-<kanal>.json yazar.
// Kota: kanal başına ~5 arama (500 birim) + birkaç liste çağrısı; haftada bir çalışır.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { CONFIG_DIR, ROOT } from './paths.js';
import { run } from './util.js';

export const RAKIP_DIR = path.join(CONFIG_DIR, 'rakipler');
const DAY = 86400000;
const PATLAMA_KAT = 3;
const MAX_RAKIP = 8;
const MAX_PATLAYAN = 12;

const sure = (iso = '') => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) ?? [];
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
};
const medyan = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const saatTR = (iso) => (new Date(iso).getUTCHours() + 3) % 24;
const gunTR = (iso) => new Date(new Date(iso).getTime() + 3 * 3600000).getUTCDay();

export function rakipAyarlari() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'rakip-arama.json'), 'utf8'));
}

async function parcali(ids, n, fn) {
  const out = [];
  for (let i = 0; i < ids.length; i += n) out.push(...await fn(ids.slice(i, i + n)));
  return out;
}

export async function rakipTara({ auth, kanalId, ayar, elle = [], now = new Date(), log = console.log }) {
  const yt = google.youtube({ version: 'v3', auth });
  const benim = (await yt.channels.list({ part: ['statistics'], id: [kanalId] })).data.items?.[0]?.statistics ?? {};
  const benimAbone = Number(benim.subscriberCount ?? 0);

  // 1) Konu kelimeleriyle son 120 günün en çok izlenen videoları → hangi kanallar öne çıkıyor
  const sayac = new Map();
  for (const q of ayar.kelimeler ?? []) {
    try {
      const r = await yt.search.list({
        part: ['snippet'], q, type: ['video'], order: 'viewCount', maxResults: 25,
        publishedAfter: new Date(now.getTime() - 120 * DAY).toISOString(),
        regionCode: ayar.bolge, relevanceLanguage: ayar.dil,
      });
      for (const it of r.data.items ?? []) {
        const c = it.snippet.channelId;
        if (c !== kanalId) sayac.set(c, (sayac.get(c) ?? 0) + 1);
      }
    } catch (e) {
      log(`  arama "${q}": ${e.message}`);
    }
  }
  const adaylar = [...new Set([...elle, ...[...sayac.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)])].slice(0, 20);
  if (!adaylar.length) return null;

  // 2) Aday kanalların istatistikleri: bizden büyük olanlar (elle eklenenler her zaman kalır)
  const kanallar = await parcali(adaylar, 50, async (ids) => (await yt.channels.list({ part: ['snippet', 'statistics', 'contentDetails'], id: ids })).data.items ?? []);
  const secili = kanallar
    .filter((c) => elle.includes(c.id) || Number(c.statistics.subscriberCount ?? 0) > benimAbone)
    .sort((a, b) => (sayac.get(b.id) ?? 0) - (sayac.get(a.id) ?? 0) || Number(b.statistics.subscriberCount) - Number(a.statistics.subscriberCount))
    .slice(0, MAX_RAKIP);

  // 3) Her rakibin son videoları; kendi medyanının 3 katı ve üstü izlenenler "patlayan"
  const rakipler = [];
  const patlayanlar = [];
  for (const c of secili) {
    try {
      const ids = (await yt.playlistItems.list({ part: ['contentDetails'], playlistId: c.contentDetails.relatedPlaylists.uploads, maxResults: 40 })).data.items.map((i) => i.contentDetails.videoId);
      const vids = await parcali(ids, 50, async (x) => (await yt.videos.list({ part: ['snippet', 'statistics', 'contentDetails'], id: x })).data.items ?? []);
      const veriler = vids.map((v) => ({
        id: v.id, baslik: v.snippet.title, izlenme: Number(v.statistics.viewCount ?? 0), begeni: Number(v.statistics.likeCount ?? 0),
        yorum: Number(v.statistics.commentCount ?? 0), sure: sure(v.contentDetails.duration), yayin: v.snippet.publishedAt,
        aciklama: (v.snippet.description ?? '').slice(0, 400), etiketler: (v.snippet.tags ?? []).slice(0, 12),
        kapak: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.default?.url,
      }));
      const med = medyan(veriler.map((v) => v.izlenme));
      rakipler.push({
        id: c.id, ad: c.snippet.title, abone: Number(c.statistics.subscriberCount ?? 0), videoSayisi: Number(c.statistics.videoCount ?? 0),
        medyanIzlenme: med, uzunOrani: veriler.length ? Math.round((veriler.filter((v) => v.sure > 180).length / veriler.length) * 100) : 0,
        yayinSaatleri: veriler.map((v) => saatTR(v.yayin)), elle: elle.includes(c.id),
      });
      for (const v of veriler) {
        const kat = med ? v.izlenme / med : 0;
        if (kat >= PATLAMA_KAT && now - Date.parse(v.yayin) <= 150 * DAY) {
          patlayanlar.push({ ...v, rakip: c.snippet.title, rakipId: c.id, kat: Math.round(kat * 10) / 10, tur: v.sure > 180 ? 'long' : 'short', saat: saatTR(v.yayin), gun: gunTR(v.yayin) });
        }
      }
    } catch (e) {
      log(`  rakip ${c.snippet.title}: ${e.message}`);
    }
  }
  patlayanlar.sort((a, b) => b.kat - a.kat);
  const secilenler = patlayanlar.slice(0, MAX_PATLAYAN).map((p, i) => ({ sira: i + 1, ...p }));

  // Rakiplerin patlayan videolarının yayın saatleri (İstanbul) – yayın saati önerisi için
  const saatDagilimi = Array.from({ length: 24 }, (_, s) => patlayanlar.filter((p) => p.saat === s).length);
  return { kanalId, guncellendi: now.toISOString(), benimAbone, rakipler, patlayanlar: secilenler, saatDagilimi };
}

// Patlayan videoların kapaklarını 4 sütunlu tek görselde birleştirir (sıra numarası soldan sağa, yukarıdan aşağı).
export async function kapakPanosu(patlayanlar, hedef) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rakip-'));
  try {
    const dosyalar = [];
    for (const p of patlayanlar) {
      if (!p.kapak) continue;
      const f = path.join(dir, `${String(p.sira).padStart(2, '0')}.jpg`);
      const res = await fetch(p.kapak);
      if (!res.ok) continue;
      fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
      dosyalar.push(f);
    }
    if (!dosyalar.length) return null;
    const n = dosyalar.length;
    const satir = Math.ceil(n / 4);
    const girdiler = dosyalar.flatMap((f) => ['-i', f]);
    const olcek = dosyalar.map((_, i) => `[${i}:v]scale=320:180,setsar=1[v${i}]`).join(';');
    const yerlesim = dosyalar.map((_, i) => `${(i % 4) * 320}_${Math.floor(i / 4) * 180}`).join('|');
    const giris = dosyalar.map((_, i) => `[v${i}]`).join('');
    const filtre = n === 1 ? `${olcek};[v0]null[out]` : `${olcek};${giris}xstack=inputs=${n}:layout=${yerlesim}:fill=black[out]`;
    await run('ffmpeg', ['-y', '-v', 'error', ...girdiler, '-filter_complex', filtre, '-map', '[out]', '-q:v', '5', hedef]);
    void satir;
    return hedef;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
