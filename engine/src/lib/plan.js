// Kanal ayarlarından "hangi gün hangi saatte hangi video" listesini çıkarır.
// Bağımlılıksızdır: hem sync (Firestore'dan sonra) hem de bulut rutini (npm install olmadan) kullanır.
import fs from 'node:fs';
import path from 'node:path';
import { options, pick, targetWords } from './options.js';
import { addDays, dateInTz, weekday, zonedToUtc } from './time.js';
import { DONE_DIR, FAILED_DIR, QUEUE_DIR } from './paths.js';
import { matchFor } from './league.js';
import { altSaat, deneyBul } from './deney.js';

const TZ = options.timezone;
const MIN_LEAD_MS = 60 * 60 * 1000; // yayına 1 saatten az kalmışsa o slotu atla
const CLIPS_PER_LONG = 3; // bir uzun videodan çıkan en fazla kesit Shorts
const CLIP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const VOTE_OPEN_MS = 6 * 60 * 60 * 1000; // oylama en az 6 saat açık kalır
// Dizi: konuşma satırlarının kelime hızı (duraklar, aksiyon ve kartlar dahil dakikada ~85 kelime).
const DIZI_KELIME_DK = 85;
const DIZI_SHORTS_KELIME = 80;

export function existingJobIds() {
  const ids = new Set();
  for (const dir of [QUEUE_DIR, DONE_DIR, FAILED_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) ids.add(f.slice(0, -5));
  }
  return ids;
}

// Dizi kanalı: bölümler uzun video günlerinde; her bölümün Shorts'u ertesi gün, Shorts saatinde.
// O gün dizinin aynı türde bir videosu zaten varsa (ör. elle yüklenmiş bölüm) slot açılmaz.
function diziSlotlari(channel, dates) {
  const s = channel.settings;
  const slots = [];
  const dolu = new Set(channelJobs(channel.id).filter((j) => j.format === 'dizi' && j.publishAt)
    .map((j) => `${j.type}:${dateInTz(new Date(j.publishAt), TZ)}`));
  // Bağımsız Shorts (ör. her gün Top 5 listesi): her Shorts saatinde ayrı bir video, bölüme bağlı değil.
  if (s.diziShorts === 'bagimsiz') {
    for (const date of dates) {
      if (s.long.days.includes(weekday(date))) slots.push({ type: 'long', idx: 1, date, time: s.long.time });
      [...s.shorts.times].sort().forEach((time, i) => slots.push({ type: 'short', idx: i + 1, date, time }));
    }
    return slots;
  }
  for (const date of dates) {
    if (s.long.days.includes(weekday(date)) && !dolu.has(`long:${date}`)) slots.push({ type: 'long', idx: 1, date, time: s.long.time });
    // Fragman: bölümden bir gün önce, gelecek bölümün merak uyandıran anları (sonu verilmez)
    const yarin = addDays(date, 1);
    if (s.diziFragman !== false && s.long.days.includes(weekday(yarin))) {
      // İki Shorts saati varsa kesit ilkinde, fragman ikincisinde (ör. 12:00 kesit, 21:00 fragman)
      const saatler = [...s.shorts.times].sort();
      slots.push({ type: 'short', idx: 2, date, time: saatler[1] ?? saatler[0], kaynak: `${yarin}_${channel.id}_long1`, fragman: true });
    }
    const dun = addDays(date, -1);
    if (s.long.days.includes(weekday(dun)) && !dolu.has(`short:${date}`)) {
      slots.push({ type: 'short', idx: 1, date, time: [...s.shorts.times].sort()[0], kaynak: `${dun}_${channel.id}_long1` });
    }
  }
  return slots;
}

function slotsFor(channel, dates, now) {
  const s = channel.settings;
  const dizi = s.contentFormat === 'dizi';
  const slots = dizi ? diziSlotlari(channel, dates) : [];
  for (const date of dizi ? [] : dates) {
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
      targetWords: dizi ? (slot.type === 'long' ? Math.round((s.long.minutes ?? 4) * DIZI_KELIME_DK) : DIZI_SHORTS_KELIME) : targetWords(s, slot.type),
      ...(dizi ? { format: 'dizi', dizi: s.dizi || null, ...(slot.kaynak ? { clipOf: slot.kaynak } : {}), ...(slot.fragman ? { fragman: true } : {}), ...(slot.type === 'short' ? { dikey: true } : {}) } : {}),
      // Flaggenduell: sezon ve maç numarası yayın gününden hesaplanır (motor da aynısını kullanır).
      ...(s.contentFormat === 'flaggenduell'
        ? { format: 'duell', ...(matchFor(slot.date, channel.league?.calendarStart ?? slot.date) ?? {}) }
        : {}),
      // Ansiklopedi stili: sahneler kodla çizilir (routine/PROMPT.md → Çizim formatı).
      ...(pick(options.visualStyles, s.visualStyle)?.theme === 'ansiklopedi' ? { format: 'cizim' } : {}),
      // Başka dillerde başlık/açıklama (YouTube yabancı izleyiciye kendi dilinde gösterir).
      ...(s.optimizasyon?.ceviri !== false && s.contentFormat !== 'flaggenduell' && options.ceviriDilleri?.[s.language]?.length
        ? { ceviriDilleri: options.ceviriDilleri[s.language] } : {}),
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
  for (const c of channels.filter((ch) => ch.settings.shorts?.source === 'uzundan' && ch.settings.contentFormat !== 'dizi')) {
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

// Yorum oylaması: yayınlanmış ve en az 6 saat geçmiş, henüz kullanılmamış her oylama sıradaki
// bağımsız Shorts'a ya da uzun videoya verilir (kesit Shorts konusunu uzun videodan aldığı için almaz).
function attachVotes(slots, channels, now) {
  for (const c of channels.filter((ch) => ch.oylamalar?.length && ch.settings.contentFormat !== 'dizi')) {
    const used = new Set(channelJobs(c.id).map((j) => j.oylama?.kaynak).filter(Boolean));
    const pending = c.oylamalar
      .filter((o) => !used.has(o.kaynak) && Date.parse(o.yayin) + VOTE_OPEN_MS <= now.getTime())
      .sort((a, b) => a.yayin.localeCompare(b.yayin));
    for (const slot of slots.filter((s) => s.channelId === c.id && !s.clipOf)) {
      const o = pending.shift();
      if (!o) break;
      const kazanan = o.oyA > o.oyB ? 'a' : o.oyB > o.oyA ? 'b' : null;
      slot.oylama = { kaynak: o.kaynak, a: o.a, b: o.b, oyA: o.oyA, oyB: o.oyB, kazanan };
    }
  }
  return slots;
}

// Deney: kanalın süren deneyi varsa o türdeki her yeni video az olan kola (A/B) verilir.
// Süre deneyinin B kolu %25 kısa yazılır, saat deneyinin B kolu alternatif saatte yayınlanır.
function attachExperiments(slots, channels, now) {
  for (const c of channels.filter((ch) => ch.deney?.id && ch.settings.optimizasyon?.deneyler !== false && ch.settings.contentFormat !== 'dizi')) {
    const d = deneyBul(c.deney.id);
    if (!d) continue;
    const count = { A: 0, B: 0 };
    for (const j of channelJobs(c.id)) if (j.deney?.id === d.id && count[j.deney.kol] !== undefined) count[j.deney.kol]++;
    for (const slot of slots.filter((s) => s.channelId === c.id && s.type === c.deney.tip)) {
      const kol = count.B < count.A ? 'B' : 'A';
      if (d.id === 'yayin-saati' && kol === 'B') {
        const at = zonedToUtc(slot.id.slice(0, 10), altSaat(c.settings.shorts.times[0]), TZ);
        if (at.getTime() - now.getTime() <= MIN_LEAD_MS) continue; // alternatif saat geçmişse bu slot deneye girmez
        slot.publishAt = at.toISOString();
      }
      if (d.id === 'sure-kisa' && kol === 'B') slot.targetWords = Math.round(slot.targetWords * 0.75);
      count[kol]++;
      slot.deney = { id: d.id, kol, ...(d[kol].talimat ? { talimat: d[kol].talimat } : {}) };
    }
  }
  return slots;
}

// Dizi bölüm numarası: kanalın bu dizideki son bölümünden devam eder (queue/ + done/ + bu turdaki slotlar).
// Shorts kaynağı olan bölümün numarasını alır; kaynak bölüm hiç yazılmamışsa Shorts slotu düşer.
function attachDizi(slots, channels) {
  const dusen = new Set();
  for (const c of channels.filter((ch) => ch.settings.contentFormat === 'dizi')) {
    const jobs = channelJobs(c.id).filter((j) => j.format === 'dizi' && j.dizi === c.settings.dizi);
    const bagimsiz = c.settings.diziShorts === 'bagimsiz';
    let son = Math.max(c.settings.diziBaslangic ?? 0, ...jobs.filter((j) => bagimsiz || j.type === 'long').map((j) => j.bolum?.no ?? 0));
    const kendi = slots.filter((s) => s.channelId === c.id).sort((a, b) => a.publishAt.localeCompare(b.publishAt));
    if (bagimsiz) {
      for (const slot of kendi) slot.bolum = { no: ++son };
      continue;
    }
    for (const slot of kendi.filter((s) => s.type === 'long')) slot.bolum = { no: ++son };
    for (const slot of kendi.filter((s) => s.type === 'short')) {
      const kaynak = kendi.find((s) => s.id === slot.clipOf) ?? jobs.find((j) => j.id === slot.clipOf);
      if (!kaynak?.bolum?.no) { dusen.add(slot.id); continue; }
      slot.bolum = { no: kaynak.bolum.no };
    }
  }
  return slots.filter((s) => !dusen.has(s.id));
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
  return attachExperiments(attachVotes(attachClips(attachDizi(jobs, channels), channels), channels, now), channels, now)
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
}
