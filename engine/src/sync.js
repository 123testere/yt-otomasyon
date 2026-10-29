// Uygulamadaki kanal ayarlarını Firestore'dan repoya aktarır ve Claude'un yazması gereken işleri
// (config/needed.json) hesaplar. Seçenek listesini de uygulama okusun diye Firestore'a yazar.
import fs from 'node:fs';
import path from 'node:path';
import { ensurePortrait } from './lib/character.js';
import { db } from './lib/firebase.js';
import { options, resolveSettings, characterOf, nicheOf, targetWords, pick } from './lib/options.js';
import { addDays, dateInTz, weekday, zonedToUtc } from './lib/time.js';
import { CONFIG_DIR, DONE_DIR, FAILED_DIR, QUEUE_DIR } from './lib/paths.js';
import { stableJson } from './lib/util.js';

const TZ = options.timezone;
const MIN_LEAD_MS = 60 * 60 * 1000; // yayına 1 saatten az kalmışsa o slotu atla
const RECENT_TITLES = 80;

function existingJobIds() {
  const ids = new Set();
  for (const dir of [QUEUE_DIR, DONE_DIR, FAILED_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) ids.add(f.slice(0, -5));
  }
  return ids;
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

function slotsFor(channel, dates, now) {
  const s = channel.settings;
  const slots = [];
  for (const date of dates) {
    if (s.long.days.includes(weekday(date))) {
      slots.push({ type: 'long', idx: 1, date, time: s.long.time });
    }
    [...s.shorts.times].sort().forEach((time, i) => slots.push({ type: 'short', idx: i + 1, date, time }));
  }
  return slots
    .map((slot) => ({ ...slot, publishAt: zonedToUtc(slot.date, slot.time, TZ) }))
    .filter((slot) => slot.publishAt.getTime() - now.getTime() > MIN_LEAD_MS)
    .map((slot) => ({
      id: `${slot.date}_${channel.id}_${slot.type}${slot.idx}`,
      channelId: channel.id,
      type: slot.type,
      publishAt: slot.publishAt.toISOString(),
      targetWords: targetWords(s, slot.type),
    }));
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

  // Karakter yüzlerini video üretiminden önce hazırla ki uygulamada önizlenebilsin.
  for (const c of channels) {
    await ensurePortrait(c.id, c.settings).catch((e) => console.warn(`${c.id} karakter yüzü: ${e.message}`));
  }

  const today = dateInTz(now, TZ);
  const dates = [today, addDays(today, 1)];
  const existing = existingJobIds();
  for (const v of videosSnap.docs) existing.add(v.id);

  const needed = channels
    .filter((c) => c.enabled)
    .flatMap((c) => slotsFor(c, dates, now))
    .filter((job) => !existing.has(job.id))
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));

  const changedChannels = writeIfChanged(path.join(CONFIG_DIR, 'channels.json'), stableJson(channels));
  const changedNeeded = writeIfChanged(path.join(CONFIG_DIR, 'needed.json'), stableJson(needed));

  console.log(`${channels.length} kanal, ${needed.length} bekleyen iş.`
    + (changedChannels || changedNeeded ? ' Dosyalar güncellendi.' : ' Değişiklik yok.'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
