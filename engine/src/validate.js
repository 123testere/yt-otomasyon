// queue/*.json senaryo dosyalarını kontrol eder. Claude rutini push etmeden önce bunu çalıştırır;
// motor da render'dan önce aynı kontrolü yapar. Bağımlılık yok, npm install olmadan çalışır.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONFIG_DIR, DONE_DIR, QUEUE_DIR, ROOT } from './lib/paths.js';
import { KAPAK_ALAN, cizimHatasi } from '../../shared/cizim.js';

const WORD_TOLERANCE = 0.3;

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const optStr = (v, max) => v === undefined || str(v, max);

// Sahnedeki hareketli grafik verisi (remotion/src/Motion.jsx bileşenleri) geçerli mi?
export function motionErrors(m) {
  if (m === undefined) return [];
  if (!m || typeof m !== 'object') return ['motion bir nesne olmalı'];
  const checks = {
    stat: () => (str(String(m.value ?? ''), 12) ? [] : ['stat.value 1-12 karakter']).concat(optStr(m.label, 40) ? [] : ['stat.label en fazla 40 karakter']),
    timeline: () => (Array.isArray(m.items) && m.items.length >= 2 && m.items.length <= 4
      && m.items.every((it) => str(String(it?.year ?? ''), 10) && str(it?.label, 40)) ? [] : ['timeline.items 2-4 öğe, her biri {year ≤10, label ≤40}']),
    compare: () => (['left', 'right'].every((k) => str(m[k]?.title, 30) && str(String(m[k]?.value ?? ''), 14))
      ? [] : ['compare.left/right {title ≤30, value ≤14} olmalı']),
    list: () => (Array.isArray(m.items) && m.items.length >= 2 && m.items.length <= 4 && m.items.every((it) => str(it, 45))
      && optStr(m.title, 30) ? [] : ['list.items 2-4 madde (≤45 karakter), title ≤30']),
    title: () => (str(m.text, 60) && optStr(m.sub, 60) ? [] : ['title.text ≤60, sub ≤60']),
    question: () => (str(m.text, 80) ? [] : ['question.text 1-80 karakter']),
    quote: () => (str(m.text, 140) && optStr(m.author, 40) ? [] : ['quote.text ≤140, author ≤40']),
    icon: () => (str(m.emoji, 8) && optStr(m.text, 30) ? [] : ['icon.emoji (tek emoji), text ≤30']),
  };
  const check = checks[m.type];
  return check ? check() : [`motion.type şunlardan biri olmalı: ${Object.keys(checks).join(', ')}`];
}

const DUELL_PHASES = ['intro', 'nodata', 'rounds', 'final', 'winner', 'why', 'table'];
const DUELL_TOPIC_IDS = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'duell-topics.json'), 'utf8')).map((t) => t.id));

// Flaggenduell senaryosu: katalogdaki bir konu, 7 bölümlük anlatım, 2-3 kısa gerekçe.
function duellErrors(d) {
  if (!d || typeof d !== 'object') return ['duell nesnesi eksik'];
  const errors = [];
  if (!DUELL_TOPIC_IDS.has(d.topicId)) errors.push(`duell.topicId katalogda yok: ${d.topicId}`);
  for (const p of DUELL_PHASES) {
    if (!str(d.script?.[p], 400)) errors.push(`duell.script.${p} eksik veya çok uzun`);
  }
  const words = DUELL_PHASES.reduce((n, p) => n + countWords(d.script?.[p] ?? ''), 0);
  if (words < 75 || words > 135) errors.push(`duell anlatımı ${words} kelime; 45 sn için 75-135 arası olmalı`);
  if (!Array.isArray(d.why) || d.why.length < 2 || d.why.length > 3 || !d.why.every((w) => str(w, 40))) {
    errors.push('duell.why 2-3 madde, her biri en fazla 40 karakter');
  }
  return errors;
}

const IFADELER = ['anlatiyor', 'merakli', 'saskin', 'gulumsuyor', 'kahkaha', 'dusunceli', 'endiseli', 'gururlu'];

// Çizim formatı (Lamba Altında): sahne çizimleri çalışmalı, görsel sahneler az olmalı, kart başlığı ve bölümler doğru olmalı.
function cizimErrors(job) {
  const errors = [];
  const scenes = Array.isArray(job.scenes) ? job.scenes : [];
  scenes.forEach((s, i) => {
    if (s.cizim !== undefined) {
      const err = cizimHatasi(s.cizim);
      if (err) errors.push(`sahne ${i + 1} cizim: ${err}`);
    } else if (!(str(s.visual?.query, 80) && str(s.visual?.prompt, 300))) {
      errors.push(`sahne ${i + 1}: cizim ya da visual {query, prompt} olmalı`);
    }
    if (s.ifade !== undefined && !IFADELER.includes(s.ifade)) errors.push(`sahne ${i + 1}: ifade şunlardan biri olmalı: ${IFADELER.join(', ')}`);
    if (s.bolum !== undefined && !(str(s.bolum?.no, 20) && str(s.bolum?.ad, 32) && optStr(s.bolum?.ust, 40))) {
      errors.push(`sahne ${i + 1}: bolum {no ≤20, ad ≤32, ust ≤40} olmalı`);
    }
  });
  const gorsel = scenes.filter((s) => s.cizim === undefined).length;
  if (gorsel > Math.ceil(scenes.length / 4)) errors.push(`${gorsel} sahne görselli; en fazla dörtte biri görsel olabilir, gerisi çizim`);
  if (!Array.isArray(job.baslikKart) || job.baslikKart.length !== 2 || !job.baslikKart.every((l) => str(l, 22))) {
    errors.push('baslikKart 2 satır olmalı, her biri en fazla 22 karakter');
  }
  if (job.kapanis !== undefined && !(str(job.kapanis?.a, 18) && str(job.kapanis?.b, 18) && optStr(job.kapanis?.soru, 30))) {
    errors.push('kapanis {a ≤18, b ≤18, soru ≤30} olmalı');
  }
  if (job.type === 'long') {
    if (!scenes.slice(1).some((s) => s.bolum)) errors.push('uzun videoda bölümler olmalı: giriş sahnelerinden sonra ilk bölümün sahnesine bolum ekle');
    if (scenes[0]?.bolum) errors.push('ilk sahne giriş (gece zemini) olmalı; bolum ilk sahnede olamaz');
    const err = cizimHatasi(job.kapakCizim, 6, { alan: KAPAK_ALAN });
    if (err) errors.push(`kapakCizim: ${err}`);
    if (!optStr(job.kapakAlt, 40)) errors.push('kapakAlt en fazla 40 karakter');
  }
  return errors;
}

// Başlıkları büyük/küçük harf, noktalama ve boşluk farkını yok sayarak karşılaştırır.
export const normalizeTitle = (t = '') => t.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');

// Kanalın daha önce kullandığı başlıklar: yüklenenler (done/), Firestore geçmişi (config/channels.json).
export function usedTitles(channelId, excludeId) {
  const titles = new Set();
  const channelsFile = path.join(CONFIG_DIR, 'channels.json');
  if (fs.existsSync(channelsFile)) {
    const channel = JSON.parse(fs.readFileSync(channelsFile, 'utf8')).find((c) => c.id === channelId);
    for (const t of channel?.recentTitles ?? []) titles.add(normalizeTitle(t));
  }
  if (fs.existsSync(DONE_DIR)) {
    for (const f of fs.readdirSync(DONE_DIR).filter((n) => n.endsWith('.json'))) {
      if (f.slice(0, -5) === excludeId) continue;
      try {
        const done = JSON.parse(fs.readFileSync(path.join(DONE_DIR, f), 'utf8'));
        if (done.channelId === channelId) titles.add(normalizeTitle(done.title));
      } catch { /* bozuk dosya başlık kontrolünü engellemesin */ }
    }
  }
  return titles;
}

// Kesit Shorts'un kaynağı olan uzun videonun senaryosu (kuyrukta ya da yüklenmiş).
function findJob(id) {
  for (const dir of [QUEUE_DIR, DONE_DIR]) {
    const file = path.join(dir, `${id}.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return null;
}

const wordsOf = (text) => text.toLocaleLowerCase('tr').match(/[\p{L}\p{N}]+/gu) ?? [];

// Kesit uzun videodan gelmeli: kelimelerinin en az %60'ı kaynak anlatımda geçmeli.
function clipErrors(job, sourceId) {
  if (job.derivedFrom !== sourceId) return [`bu Shorts "${sourceId}" uzun videosunun kesiti: derivedFrom = "${sourceId}" olmalı`];
  const source = findJob(sourceId);
  if (!source) return [`kaynak uzun video bulunamadı: ${sourceId} (önce onu queue/ içine yaz)`];
  const pool = new Set(source.scenes.flatMap((s) => wordsOf(s.narration)));
  const words = (job.scenes ?? []).flatMap((s) => wordsOf(s.narration ?? ''));
  const share = words.length ? words.filter((w) => pool.has(w)).length / words.length : 0;
  return share >= 0.6 ? [] : [`kesit anlatımının yalnızca %${Math.round(share * 100)}'i uzun videodan; en az %60 olmalı`];
}

export function validateJob(job, { fileId, needed, takenTitles } = {}) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  req(typeof job === 'object' && job, 'JSON bir nesne olmalı');
  if (errors.length) return errors;

  req(typeof job.id === 'string' && job.id, 'id eksik');
  if (fileId) req(job.id === fileId, `id (${job.id}) dosya adıyla (${fileId}) aynı olmalı`);
  req(['long', 'short'].includes(job.type), 'type "long" veya "short" olmalı');
  req(typeof job.channelId === 'string' && job.channelId, 'channelId eksik');
  req(!Number.isNaN(Date.parse(job.publishAt)), 'publishAt geçerli bir ISO tarih olmalı');

  req(typeof job.title === 'string' && job.title.trim().length > 0 && job.title.length <= 100, 'title 1-100 karakter olmalı');
  req(typeof job.description === 'string' && job.description.length <= 4500, 'description en fazla 4500 karakter olmalı');
  for (const field of ['title', 'description']) {
    if (/[<>]/.test(job[field] ?? '')) errors.push(`${field} içinde < veya > olamaz (YouTube reddeder)`);
  }
  if (takenTitles && typeof job.title === 'string' && takenTitles.has(normalizeTitle(job.title))) {
    errors.push(`"${job.title}" başlığı bu kanalda daha önce kullanıldı; yeni bir başlık yaz`);
  }
  req(Array.isArray(job.tags) && job.tags.every((t) => typeof t === 'string'), 'tags metin dizisi olmalı');
  if (Array.isArray(job.tags)) req(job.tags.join(',').length <= 450, 'tags toplamı 450 karakteri geçmemeli');
  req(typeof job.topic === 'string' && job.topic.trim(), 'topic (kısa konu özeti) eksik');
  if (job.hookText !== undefined) {
    req(typeof job.hookText === 'string' && job.hookText.trim() && job.hookText.length <= 40 && !/\n/.test(job.hookText),
      'hookText tek satır, 1-40 karakter olmalı');
  }

  if (job.type === 'long') {
    req(typeof job.thumbnailText === 'string' && job.thumbnailText.trim() && job.thumbnailText.length <= 40,
      'thumbnailText 1-40 karakter olmalı');
    if (job.format !== 'cizim') req(typeof job.thumbnailPrompt === 'string' && job.thumbnailPrompt.trim(), 'thumbnailPrompt eksik');
  }

  if (job.format === 'duell') {
    errors.push(...duellErrors(job.duell));
    const slot = needed?.find((n) => n.id === job.id);
    if (slot?.match) {
      req(typeof job.title === 'string' && job.title.startsWith(`Duell ${slot.match}/${slot.total}`),
        `title "Duell ${slot.match}/${slot.total}: …" ile başlamalı`);
    }
    return errors;
  }

  req(Array.isArray(job.scenes) && job.scenes.length > 0, 'scenes boş olamaz');
  const cizim = job.format === 'cizim';
  if (cizim) errors.push(...cizimErrors(job));
  (job.scenes ?? []).forEach((s, i) => {
    req(typeof s.narration === 'string' && s.narration.trim(), `sahne ${i + 1}: narration eksik`);
    if (cizim) {
      if (typeof s.narration === 'string') req(countWords(s.narration) <= 90, `sahne ${i + 1}: 90 kelimeden uzun, böl`);
      return;
    }
    req(typeof s.visual?.query === 'string' && s.visual.query.trim(), `sahne ${i + 1}: visual.query eksik`);
    req(typeof s.visual?.prompt === 'string' && s.visual.prompt.trim(), `sahne ${i + 1}: visual.prompt eksik`);
    if (typeof s.narration === 'string') req(countWords(s.narration) <= 90, `sahne ${i + 1}: 90 kelimeden uzun, böl`);
    for (const err of motionErrors(s.visual?.motion)) errors.push(`sahne ${i + 1}: ${err}`);
  });

  const slot = needed?.find((n) => n.id === job.id);
  if (slot && Array.isArray(job.scenes)) {
    const words = job.scenes.reduce((sum, s) => sum + countWords(s.narration ?? ''), 0);
    const min = Math.round(slot.targetWords * (1 - WORD_TOLERANCE));
    const max = Math.round(slot.targetWords * (1 + WORD_TOLERANCE));
    req(words >= min && words <= max, `toplam ${words} kelime; hedef ${slot.targetWords} (${min}-${max} arası olmalı)`);
    req(job.type === slot.type && job.channelId === slot.channelId, 'type/channelId needed.json ile uyuşmuyor');
    if (slot.clipOf) errors.push(...clipErrors(job, slot.clipOf));
    if (slot.format === 'cizim') req(job.format === 'cizim', 'bu kanal çizim formatında: "format": "cizim" olmalı');
  }
  return errors;
}

export function loadNeeded() {
  const file = path.join(CONFIG_DIR, 'needed.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const needed = loadNeeded();
  const files = fs.existsSync(QUEUE_DIR) ? fs.readdirSync(QUEUE_DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const queuedTitles = {}; // kuyruktaki dosyalar birbirinin başlığını da tekrar etmesin
  let bad = 0;
  for (const f of files) {
    let errors;
    try {
      const job = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8'));
      const takenTitles = usedTitles(job.channelId, job.id);
      for (const t of queuedTitles[job.channelId] ?? []) takenTitles.add(t);
      errors = validateJob(job, { fileId: f.slice(0, -5), needed, takenTitles });
      (queuedTitles[job.channelId] ??= []).push(normalizeTitle(job.title));
    } catch (e) {
      errors = [`JSON okunamadı: ${e.message}`];
    }
    if (errors.length) {
      bad++;
      console.log(`✗ ${f}\n  - ${errors.join('\n  - ')}`);
    } else {
      console.log(`✓ ${f}`);
    }
  }
  console.log(`${files.length} dosya, ${bad} hatalı.`);
  process.exit(bad ? 1 : 0);
}
