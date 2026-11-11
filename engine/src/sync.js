// Uygulamadaki kanal ayarlarını Firestore'dan repoya aktarır ve Claude'un yazması gereken işleri
// (config/needed.json) hesaplar. Seçenek listesini de uygulama okusun diye Firestore'a yazar.
import fs from 'node:fs';
import path from 'node:path';
import { ensurePortrait } from './lib/character.js';
import { db } from './lib/firebase.js';
import { options, resolveSettings, characterOf, nicheOf, pick } from './lib/options.js';
import { neededJobs } from './lib/plan.js';
import { CONFIG_DIR, ROOT } from './lib/paths.js';
import { stableJson } from './lib/util.js';
import { google } from 'googleapis';
import { authFor } from './pipeline/youtube.js';
import { updateStats } from './lib/stats.js';
import { countVotes } from './lib/votes.js';
import { publishDueReels, publishDueTiktok } from './lib/instagram-queue.js';
import { aktifDersler, optimizeChannel } from './lib/optimize.js';
import { collectComments, postReplies } from './lib/comments.js';
import { akislariTazele } from './lib/haberler.js';
import { sosyalGuncelle } from './lib/sosyal.js';
import { kesifEsitle } from './lib/kesif-esitle.js';
import { saatleriYaz } from './lib/sosyal-saatler.js';

const RECENT_TITLES = 80;
const YOUTUBE_TTL_MS = 20 * 60 * 60 * 1000;

// Kanalın YouTube'daki son 50 başlığı (elle yüklenenler dahil) ve toplam video sayısı; günde bir okunur (~2 kota birimi).
// Senaryo yazarı bu konuları tekrarlamaz.
async function youtubeInfo(firestore, doc) {
  const saved = doc.data().youtube ?? null;
  if (saved?.fetchedAt?.toMillis?.() > Date.now() - YOUTUBE_TTL_MS) return saved;
  try {
    const secret = (await firestore.doc(`secrets/${doc.id}`).get()).data();
    if (!secret?.refreshToken) return saved;
    const yt = google.youtube({ version: 'v3', auth: authFor(secret) });
    const channel = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items?.[0];
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return saved;
    const { data } = await yt.playlistItems.list({ part: ['snippet'], playlistId: uploads, maxResults: 50 });
    // Kanalın oynatma listeleri: senaryo yazarı videoyu uygun listeye koyar (yoksa yeni liste adı önerir).
    const lists = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50 }).catch(() => null);
    const info = {
      titles: (data.items ?? []).map((i) => i.snippet.title), videoCount: data.pageInfo?.totalResults ?? 0,
      playlists: (lists?.data.items ?? []).map((p) => p.snippet.title), fetchedAt: new Date(),
    };
    await doc.ref.update({ youtube: info });
    return info;
  } catch (e) {
    console.warn(`${doc.id} YouTube başlıkları okunamadı: ${e.message}`);
    return saved;
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

async function main() {
  const firestore = db();
  const now = new Date();

  await firestore.doc('meta/options').set({ json: JSON.stringify(options), updatedAt: now });

  const videosSnap = await firestore.collection('videos').select('channelId', 'title', 'createdAt', 'status').get();
  const titlesByChannel = {};
  for (const v of videosSnap.docs) {
    const { channelId, title, createdAt, status } = v.data();
    // Sadece yayınlananlar geçmişe girer; kuyrukta bekleyen bir iş kendi başlığına takılmasın.
    if (!channelId || !title || status !== 'uploaded') continue;
    (titlesByChannel[channelId] ??= []).push({ title, at: createdAt?.toMillis?.() ?? 0 });
  }

  const youtube = {};
  const performans = readJson(path.join(CONFIG_DIR, 'performans.json'), {});
  let kapakIsi = false;
  for (const doc of (await firestore.collection('channels').get()).docs) {
    youtube[doc.id] = await youtubeInfo(firestore, doc);
    await updateStats(firestore, doc, now).catch((e) => console.warn(`${doc.id} istatistik: ${e.message}`));
    // Optimizasyon (günde bir): video ölçüleri, teşhis, deneyler, haftalık rapor.
    const o = await optimizeChannel(firestore, doc, now).catch((e) => console.warn(`${doc.id} optimizasyon: ${e.stack ?? e.message}`));
    if (o?.ozet) performans[doc.id] = o.ozet;
    if (o?.kapakIsi) kapakIsi = true;
  }
  // Optimizasyon kanal kayıtlarını güncelledi (deney, dersler); güncel hali okunur.
  const channelsSnap = await firestore.collection('channels').get();
  const votes = await countVotes(firestore, now);
  await publishDueReels(firestore, now).catch((e) => console.warn(`Instagram: ${e.message}`));
  await publishDueTiktok(firestore, now).catch((e) => console.warn(`TikTok: ${e.message}`));
  await sosyalGuncelle(firestore, now).catch((e) => console.warn(`Sosyal istatistik: ${e.message}`));
  await saatleriYaz(firestore, now).catch((e) => console.warn(`sosyal saatler: ${e.message}`));
  const channels = channelsSnap.docs
    .map((doc) => {
      const data = doc.data();
      const settings = resolveSettings(data.settings);
      const niche = nicheOf(settings);
      const character = characterOf(settings);
      return {
        id: doc.id,
        title: data.title ?? doc.id,
        enabled: Boolean(settings.enabled),
        settings,
        // Claude'un senaryo yazarken bakacağı okunabilir özet:
        brief: {
          format: settings.contentFormat ?? 'belgesel',
          konu: niche.custom ? settings.customNiche : niche.label,
          dil: pick(options.languages, settings.language).label,
          ton: pick(options.tones, settings.tone)?.hint,
          karakter: character?.persona ?? null,
          gorselStil: pick(options.visualStyles, settings.visualStyle)?.label,
          cocukIcerigi: Boolean(niche.madeForKids),
          ekTalimat: settings.extraInstructions || null,
          videoSayisi: youtube[doc.id]?.videoCount ?? null,
          // Kanalın kendi verisinden öğrenilmiş kurallar (deneyler ve haftalık analiz); senaryo yazarı uyar.
          dersler: aktifDersler(data),
        },
        oynatmaListeleri: youtube[doc.id]?.playlists ?? [],
        // Süren A/B deneyi: planlayıcı videoları kollara dağıtır.
        deney: settings.optimizasyon?.deneyler !== false ? data.optimizasyon?.deney ?? null : null,
        recentTitles: [...new Set([
          ...(titlesByChannel[doc.id] ?? []).sort((a, b) => b.at - a.at).map((t) => t.title),
          ...(youtube[doc.id]?.titles ?? []),
        ])].slice(0, RECENT_TITLES),
        // Yorum oylamaları (Shorts sonundaki A/B kartı): planlayıcı kazananı sıradaki videoya verir.
        oylamalar: votes[doc.id] ?? [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  // Flaggenduell kanallarında sezon takvimi ve güncel puan tablosu (Claude anlatımda kullanır, plan maç numarasını hesaplar).
  const euroNames = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'europe-coe.json'), 'utf8')).map((c) => [c.iso2, c.name]));
  for (const c of channels.filter((ch) => ch.settings.contentFormat === 'flaggenduell')) {
    const lg = (await firestore.doc(`leagues/${c.id}`).get()).data();
    if (!lg) continue;
    c.league = {
      calendarStart: lg.calendarStart, season: lg.season ?? 1, lastMatch: lg.lastMatch ?? 0,
      table: Object.entries(lg.points ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([iso2, points]) => ({ name: euroNames[iso2] ?? iso2, points })),
    };
  }

  // Flaggenduell kanalı varsa Claude'un bakacağı veri sıralamalarını (haftada bir) tazele.
  if (channels.some((c) => c.enabled && c.settings.contentFormat === 'flaggenduell')) {
    const { refreshStandings } = await import('./league/catalog.js');
    if (await refreshStandings()) console.log('Flaggenduell sıralamaları güncellendi.');
  }

  // Karakter yüzlerini video üretiminden önce hazırla ki uygulamada önizlenebilsin.
  for (const c of channels) {
    await ensurePortrait(c.id, c.settings).catch((e) => console.warn(`${c.id} karakter yüzü: ${e.message}`));
  }

  const needed = neededJobs(channels, { now, extraExisting: videosSnap.docs.map((v) => v.id) });
  await akislariTazele(channels, { now }).catch((e) => console.warn(`Haber akışı: ${e.message}`));

  // Uygulamadan gelen kanal kurulum isteği varsa iş akışı Remotion'u kurup engine/src/kurulum.js'i çalıştırır.
  const setupPending = channelsSnap.docs.some((d) => d.data().settings?.kurulum?.istek
    && d.data().settings.kurulum.istek !== d.data().kurulumSonuc?.istek);
  if (setupPending && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'kurulum=1\n');
  // Zayıf kapak denemesi (yeni kapak çizmek Remotion ister): iş akışı engine/src/kapak-dene.js'i çalıştırır.
  // Claude'un günlük iyileştirme dosyaları (iyilestirme/*.json) da aynı iş akışında uygulanır.
  const iyiDir = path.join(ROOT, 'iyilestirme');
  if (fs.existsSync(iyiDir) && fs.readdirSync(iyiDir).some((f) => f.endsWith('.json'))) kapakIsi = true;
  if (kapakIsi && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'kapak=1\n');
  writeIfChanged(path.join(CONFIG_DIR, 'performans.json'), stableJson(performans));
  // Keşif: Claude'un fırsat değerlendirmesi (analiz/kesif.json) uygulamaya; "Örnek yap" istekleri rutine (config/kesif-istekler.json)
  await kesifEsitle(firestore, now).catch((e) => console.warn(`keşif: ${e.message}`));
  // Claude'un rakip analizleri (analiz/rakip-<kanal>.json) uygulamada görünsün diye Firestore'a aktarılır.
  const analizDir = path.join(ROOT, 'analiz');
  for (const f of fs.existsSync(analizDir) ? fs.readdirSync(analizDir).filter((n) => /^rakip-.+\.json$/.test(n)) : []) {
    try {
      const rapor = JSON.parse(fs.readFileSync(path.join(analizDir, f), 'utf8'));
      const ref = firestore.doc(`rakip/${f.slice(6, -5)}`);
      if ((await ref.get()).data()?.rapor?.kaynak !== rapor.kaynak) await ref.set({ rapor, raporAt: now }, { merge: true });
    } catch (e) {
      console.warn(`rakip raporu ${f}: ${e.message}`);
    }
  }

  // Yorumlara otomatik cevap (açık kanallarda): rutinin yazdığı cevapları gönder, cevapsızları topla.
  const gonderilen = await postReplies(firestore).catch((e) => console.warn(`yorum cevapları: ${e.message}`));
  if (gonderilen) console.log(`${gonderilen} yorum cevaplandı.`);
  const yorumlar = await collectComments(firestore, channels, now).catch((e) => {
    console.warn(`yorumlar: ${e.message}`);
    return [];
  });
  writeIfChanged(path.join(CONFIG_DIR, 'yorumlar.json'), stableJson(yorumlar));

  const changedChannels = writeIfChanged(path.join(CONFIG_DIR, 'channels.json'), stableJson(channels));
  const changedNeeded = writeIfChanged(path.join(CONFIG_DIR, 'needed.json'), stableJson(needed));

  console.log(`${channels.length} kanal, ${needed.length} bekleyen iş.`
    + (changedChannels || changedNeeded ? ' Dosyalar güncellendi.' : ' Değişiklik yok.'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
