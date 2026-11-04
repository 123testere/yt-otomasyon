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
import { oauthClient } from './pipeline/youtube.js';
import { countVotes } from './lib/votes.js';

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
    const auth = oauthClient();
    auth.setCredentials({ refresh_token: secret.refreshToken });
    const yt = google.youtube({ version: 'v3', auth });
    const channel = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items?.[0];
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return saved;
    const { data } = await yt.playlistItems.list({ part: ['snippet'], playlistId: uploads, maxResults: 50 });
    const info = { titles: (data.items ?? []).map((i) => i.snippet.title), videoCount: data.pageInfo?.totalResults ?? 0, fetchedAt: new Date() };
    await doc.ref.update({ youtube: info });
    return info;
  } catch (e) {
    console.warn(`${doc.id} YouTube başlıkları okunamadı: ${e.message}`);
    return saved;
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

  const channelsSnap = await firestore.collection('channels').get();
  const youtube = {};
  for (const doc of channelsSnap.docs) youtube[doc.id] = await youtubeInfo(firestore, doc);
  const votes = await countVotes(firestore, now);
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
        },
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

  const changedChannels = writeIfChanged(path.join(CONFIG_DIR, 'channels.json'), stableJson(channels));
  const changedNeeded = writeIfChanged(path.join(CONFIG_DIR, 'needed.json'), stableJson(needed));

  console.log(`${channels.length} kanal, ${needed.length} bekleyen iş.`
    + (changedChannels || changedNeeded ? ' Dosyalar güncellendi.' : ' Değişiklik yok.'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
