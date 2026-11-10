// Keşif: yeni açılmış ve hızla büyüyen animasyon kanalları (fırsat taraması).
// Sonuç config/kesif.json + config/kesif.jpg (her adayın en iyi videosunun kapağı, sırayla);
// Claude rutini değerlendirip analiz/kesif.json yazar, uygulama "Keşif" sekmesinde gösterir.
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { CONFIG_DIR, ROOT } from './paths.js';
import { kapakPanosu } from './rakip.js';

const DAY = 86400000;
const MAX_ADAY = 16;
const sure = (iso = '') => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) ?? [];
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
};

export const KESIF_JSON = path.join(CONFIG_DIR, 'kesif.json');
export const KESIF_JPG = path.join(CONFIG_DIR, 'kesif.jpg');

export function kesifAyarlari() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'kesif.json'), 'utf8'));
}

async function parcali(ids, n, fn) {
  const out = [];
  for (let i = 0; i < ids.length; i += n) out.push(...await fn(ids.slice(i, i + n)));
  return out;
}

export async function kesifTara({ auth, haric = [], reddedilen = [], now = new Date(), log = console.log }) {
  const ayar = kesifAyarlari();
  const yt = google.youtube({ version: 'v3', auth });
  const kaynak = new Map(); // kanal → hangi aramada bulundu
  for (const a of ayar.aramalar) {
    try {
      const r = await yt.search.list({
        part: ['snippet'], q: a.q, type: ['video'], order: 'viewCount', maxResults: 50,
        publishedAfter: new Date(now.getTime() - 60 * DAY).toISOString(), regionCode: a.bolge, relevanceLanguage: a.dil,
      });
      for (const it of r.data.items ?? []) if (!kaynak.has(it.snippet.channelId)) kaynak.set(it.snippet.channelId, a);
    } catch (e) {
      log(`  arama "${a.q}": ${e.message}`);
    }
  }
  const ids = [...kaynak.keys()].filter((id) => !haric.includes(id) && !reddedilen.includes(id));
  const kanallar = await parcali(ids, 50, async (x) => (await yt.channels.list({ part: ['snippet', 'statistics', 'contentDetails'], id: x })).data.items ?? []);
  const genc = kanallar
    .map((c) => {
      const yas = Math.max(1, (now - Date.parse(c.snippet.publishedAt)) / DAY);
      const izlenme = Number(c.statistics.viewCount ?? 0);
      return { c, yas, izlenme, gunluk: izlenme / yas };
    })
    .filter((x) => x.yas <= ayar.maxYasGun && Number(x.c.statistics.videoCount ?? 0) >= 3 && x.gunluk >= ayar.minGunlukIzlenme)
    .sort((a, b) => b.gunluk - a.gunluk)
    .slice(0, MAX_ADAY);

  const adaylar = [];
  for (const { c, yas, izlenme, gunluk } of genc) {
    try {
      const vidIds = (await yt.playlistItems.list({ part: ['contentDetails'], playlistId: c.contentDetails.relatedPlaylists.uploads, maxResults: 25 })).data.items.map((i) => i.contentDetails.videoId);
      const vids = (await yt.videos.list({ part: ['snippet', 'statistics', 'contentDetails'], id: vidIds })).data.items ?? [];
      const enIyi = vids.map((v) => ({
        id: v.id, baslik: v.snippet.title, izlenme: Number(v.statistics.viewCount ?? 0), sure: sure(v.contentDetails.duration),
        yayin: v.snippet.publishedAt, kapak: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url,
        aciklama: (v.snippet.description ?? '').slice(0, 300),
      })).sort((a, b) => b.izlenme - a.izlenme).slice(0, 3);
      const a = kaynak.get(c.id);
      adaylar.push({
        id: c.id, ad: c.snippet.title, ulke: c.snippet.country ?? null, dil: a.dil, arama: a.q,
        acilis: c.snippet.publishedAt, yasGun: Math.round(yas), abone: Number(c.statistics.subscriberCount ?? 0),
        izlenme, videoSayisi: Number(c.statistics.videoCount ?? 0), gunlukIzlenme: Math.round(gunluk),
        avatar: c.snippet.thumbnails?.medium?.url ?? null, aciklama: (c.snippet.description ?? '').slice(0, 300), enIyi,
      });
    } catch (e) {
      log(`  aday ${c.snippet.title}: ${e.message}`);
    }
  }
  return { guncellendi: now.toISOString(), adaylar: adaylar.map((a, i) => ({ sira: i + 1, ...a })) };
}

// Her adayın en iyi videosunun kapağı, sırayla tek panoda (Claude görsel olarak inceler).
export async function kesifPanosu(sonuc) {
  const ogeler = sonuc.adaylar.filter((a) => a.enIyi[0]?.kapak).map((a) => ({ sira: a.sira, kapak: a.enIyi[0].kapak }));
  return kapakPanosu(ogeler, KESIF_JPG);
}
