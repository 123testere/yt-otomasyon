// Kanal ayarlarından "hangi gün hangi saatte hangi video" listesini çıkarır.
// Bağımlılıksızdır: hem sync (Firestore'dan sonra) hem de bulut rutini (npm install olmadan) kullanır.
import fs from 'node:fs';
import path from 'node:path';
import { options, targetWords } from './options.js';
import { addDays, dateInTz, weekday, zonedToUtc } from './time.js';
import { DONE_DIR, FAILED_DIR, QUEUE_DIR } from './paths.js';
import { matchFor } from './league.js';

const TZ = options.timezone;
const MIN_LEAD_MS = 60 * 60 * 1000; // yayına 1 saatten az kalmışsa o slotu atla
const CLIPS_PER_LONG = 3; // bir uzun videodan çıkan en fazla kesit Shorts
const CLIP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
      // Flaggenduell: sezon ve maç numarası yayın gününden hesaplanır (motor da aynısını kullanır).
      ...(s.contentFormat === 'flaggenduell'
        ? { format: 'duell', ...(matchFor(slot.date, channel.league?.calendarStart ?? slot.date) ?? {}) }
        : {}),
    }));
}

function channelJobs(channelId) {
  const jobs = [];
  for (const dir of [QUEUE_DIR, DONE_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      try {
        const job = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (job.channelId === channelId) jobs.push(job);
      } catch { /* bozuk dosya planı engellemesin */ }
    }
  }
  return jobs;
}

// "Uzun videodan kesit" seçili kanalda her Shorts, yayınından önceki 7 gün içinde çıkan son uzun videoya bağlanır.
// Kesit hakkı dolmuşsa ya da uzun video yoksa Shorts bağımsız yazılır. Aynı turda yazılacak uzun video da kaynak olabilir.
function attachClips(slots, channels) {
  for (const c of channels.filter((ch) => ch.settings.shorts?.source === 'uzundan')) {
    const jobs = channelJobs(c.id);
    const longs = [...jobs, ...slots.filter((s) => s.channelId === c.id)]
      .filter((j) => j.type === 'long')
      .sort((a, b) => b.publishAt.localeCompare(a.publishAt));
    const used = {};
    for (const j of jobs) if (j.derivedFrom) used[j.derivedFrom] = (used[j.derivedFrom] ?? 0) + 1;
    for (const slot of slots.filter((s) => s.channelId === c.id && s.type === 'short')) {
      const at = Date.parse(slot.publishAt);
      const source = longs.find((l) => Date.parse(l.publishAt) < at && at - Date.parse(l.publishAt) <= CLIP_WINDOW_MS
        && (used[l.id] ?? 0) < CLIPS_PER_LONG);
      if (!source) continue;
      used[source.id] = (used[source.id] ?? 0) + 1;
      slot.clipOf = source.id;
    }
  }
  return slots;
}

// Bugün ve yarın için, açık kanalların henüz yazılmamış video slotları.
export function neededJobs(channels, { now = new Date(), extraExisting = [] } = {}) {
  const today = dateInTz(now, TZ);
  const dates = [today, addDays(today, 1)];
  const existing = existingJobIds();
  for (const id of extraExisting) existing.add(id);
  const jobs = channels
    .filter((c) => c.enabled)
    .flatMap((c) => slotsFor(c, dates, now))
    .filter((job) => !existing.has(job.id))
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  return attachClips(jobs, channels);
}
