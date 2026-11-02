// Uygulamadaki kanal ayarlarını Firestore'dan repoya aktarır ve Claude'un yazması gereken işleri
// (config/needed.json) hesaplar. Seçenek listesini de uygulama okusun diye Firestore'a yazar.
import fs from 'node:fs';
import path from 'node:path';
import { ensurePortrait } from './lib/character.js';
import { db } from './lib/firebase.js';
import { options, resolveSettings, characterOf, nicheOf, pick } from './lib/options.js';
import { neededJobs } from './lib/plan.js';
import { CONFIG_DIR } from './lib/paths.js';
import { stableJson } from './lib/util.js';

const RECENT_TITLES = 80;

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
        },
        recentTitles: (titlesByChannel[doc.id] ?? [])
          .sort((a, b) => b.at - a.at)
          .slice(0, RECENT_TITLES)
          .map((t) => t.title),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

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
