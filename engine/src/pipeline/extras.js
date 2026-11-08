// Yükleme sonrası keşif ekstraları (hepsi ücretsiz, hiçbiri videonun yayınını engellemez):
// - altyazı dosyası (anlatım metninden, kelime zamanlarıyla): arama ve öneride YouTube videoyu daha iyi anlar
// - başka dillerde başlık/açıklama (localizations): yabancı izleyici kendi dilinde görür
// - oynatma listesi: izleyici kanalda kalır
// - uzun videoda bölüm zaman damgaları (açıklamada; yüklemeden önce eklenir)
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { alignWords } from './subtitles.js';
import { authFor } from './youtube.js';

const GIRIS = { tr: 'Giriş', de: 'Einleitung', en: 'Intro', es: 'Introducción' };
const MIN_BOLUM_SN = 10;

const zaman = (sn) => {
  const s = Math.max(0, Math.floor(sn));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
};

// "bolum" işaretli sahnelerden YouTube bölümleri: ilk satır 00:00, en az 3 bölüm, her biri ≥10 sn.
export function bolumSatirlari(job, sahneZaman, language) {
  if (job.type !== 'long' || !sahneZaman?.length) return null;
  const list = [];
  job.scenes.forEach((s, i) => {
    if (!s.bolum?.ad || sahneZaman[i] == null) return;
    list.push({ t: sahneZaman[i], ad: s.bolum.no ? `${s.bolum.no}: ${s.bolum.ad}` : s.bolum.ad });
  });
  if (!list.length) return null;
  if (list[0].t >= MIN_BOLUM_SN) list.unshift({ t: 0, ad: GIRIS[language] ?? GIRIS.en });
  else list[0].t = 0;
  const temiz = list.filter((b, i) => i === 0 || b.t - list[i - 1].t >= MIN_BOLUM_SN);
  if (temiz.length < 3) return null;
  return temiz.map((b) => `${zaman(b.t)} ${b.ad.replace(/[<>]/g, '')}`).join('\n');
}

const srtZaman = (sn) => {
  const ms = Math.max(0, Math.round(sn * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
};

// Anlatımın kelime zamanlarından SRT (satır başına ≤42 karakter, cümle sonunda yeni satır).
export function srtOf(job, narrated) {
  const cues = [];
  narrated.scenes.forEach((s, i) => {
    if (!s.words?.length || !job.scenes[i]?.narration) return;
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      const last = cur.at(-1);
      cues.push({ a: cur[0].t, b: last.t + (last.d ?? 0.3), text: cur.map((w) => w.text).join(' ') });
      cur = [];
    };
    for (const w of alignWords(job.scenes[i].narration, s.words)) {
      const len = cur.reduce((n, x) => n + x.text.length + 1, 0);
      if (cur.length && len + w.text.length > 42) flush();
      cur.push(w);
      if (/[.!?…]$/.test(w.text)) flush();
    }
    flush();
  });
  if (!cues.length) return null;
  return cues.map((c, i) => `${i + 1}\n${srtZaman(c.a)} --> ${srtZaman(Math.max(c.b, c.a + 0.5))}\n${c.text}\n`).join('\n');
}

const izinYok = (e) => e?.response?.status === 403 || e?.code === 403 || /insufficient|forbidden|permission/i.test(e?.message ?? '');

async function playlistId(yt, title) {
  let pageToken;
  do {
    const { data } = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken });
    const found = (data.items ?? []).find((p) => p.snippet.title.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase());
    if (found) return found.id;
    pageToken = data.nextPageToken;
  } while (pageToken);
  const { data } = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title }, status: { privacyStatus: 'public' } } });
  return data.id;
}

// Döner: { altyazi, ceviri, liste } her biri 'tamam' | 'izin yok' | hata metni | undefined (yapılmadı); izinEksik: bool.
export async function uploadExtras({ secret, job, settings, videoId, srt, hashtags }) {
  const opt = settings.optimizasyon ?? {};
  const yt = google.youtube({ version: 'v3', auth: authFor(secret) });
  const sonuc = {};
  let izinEksik = false;
  const dene = async (ad, fn) => {
    try {
      await fn();
      sonuc[ad] = 'tamam';
    } catch (e) {
      if (izinYok(e)) izinEksik = true;
      sonuc[ad] = izinYok(e) ? 'izin yok' : String(e.message).slice(0, 200);
      console.warn(`  ${ad}: ${sonuc[ad]}`);
    }
  };
  if (opt.altyazi !== false && srt) {
    await dene('altyazi', () => yt.captions.insert({
      part: ['snippet'],
      requestBody: { snippet: { videoId, language: settings.language, name: '', isDraft: false } },
      media: { mimeType: 'application/octet-stream', body: Readable.from([srt]) },
    }));
  }
  const ceviriler = Object.entries(job.ceviriler ?? {}).filter(([dil]) => dil !== settings.language);
  if (opt.ceviri !== false && ceviriler.length) {
    await dene('ceviri', () => yt.videos.update({
      part: ['localizations'],
      requestBody: {
        id: videoId,
        localizations: Object.fromEntries(ceviriler.map(([dil, c]) => [dil, {
          title: c.title.trim().slice(0, 100),
          description: [c.description.trim(), hashtags].filter(Boolean).join('\n\n').slice(0, 4900),
        }])),
      },
    }));
  }
  if (opt.oynatmaListesi !== false && job.oynatmaListesi?.trim()) {
    await dene('liste', async () => {
      const id = await playlistId(yt, job.oynatmaListesi);
      await yt.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: id, resourceId: { kind: 'youtube#video', videoId } } } });
    });
  }
  return { ...sonuc, izinEksik };
}


// Kesit Shorts'una kanal sahibinin yorumu: uzun videonun/bölümün bağlantısı (Shorts'tan uzun videoya geçişi artırır).
// API yorumu sabitleyemez; kanal sahibinin yorumu yine de üstte görünür.
export async function baglantiYorumu({ secret, videoId, metin }) {
  const yt = google.youtube({ version: 'v3', auth: authFor(secret) });
  await yt.commentThreads.insert({
    part: ['snippet'],
    requestBody: { snippet: { videoId, topLevelComment: { snippet: { textOriginal: metin } } } },
  });
}
