// Kanal ayarlarından "hangi gün hangi saatte hangi video" listesini çıkarır.
// Bağımlılıksızdır: hem sync (Firestore'dan sonra) hem de bulut rutini (npm install olmadan) kullanır.
import fs from 'node:fs';
import { options, targetWords } from './options.js';
import { addDays, dateInTz, weekday, zonedToUtc } from './time.js';
import { DONE_DIR, FAILED_DIR, QUEUE_DIR } from './paths.js';

const TZ = options.timezone;
const MIN_LEAD_MS = 60 * 60 * 1000; // yayına 1 saatten az kalmışsa o slotu atla

export function existingJobIds() {
  const ids = new Set();
  for (const dir of [QUEUE_DIR, DONE_DIR, FAILED_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) ids.add(f.slice(0, -5));
  }
  return ids;
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

// Bugün ve yarın için, açık kanalların henüz yazılmamış video slotları.
export function neededJobs(channels, { now = new Date(), extraExisting = [] } = {}) {
  const today = dateInTz(now, TZ);
  const dates = [today, addDays(today, 1)];
  const existing = existingJobIds();
  for (const id of extraExisting) existing.add(id);
  return channels
    .filter((c) => c.enabled)
    .flatMap((c) => slotsFor(c, dates, now))
    .filter((job) => !existing.has(job.id))
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
}
