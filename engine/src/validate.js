// queue/*.json senaryo dosyalarını kontrol eder. Claude rutini push etmeden önce bunu çalıştırır;
// motor da render'dan önce aynı kontrolü yapar. Bağımlılık yok, npm install olmadan çalışır.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONFIG_DIR, DONE_DIR, QUEUE_DIR } from './lib/paths.js';

const WORD_TOLERANCE = 0.3;

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

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

  if (job.type === 'long') {
    req(typeof job.thumbnailText === 'string' && job.thumbnailText.trim() && job.thumbnailText.length <= 40,
      'thumbnailText 1-40 karakter olmalı');
    req(typeof job.thumbnailPrompt === 'string' && job.thumbnailPrompt.trim(), 'thumbnailPrompt eksik');
  }

  req(Array.isArray(job.scenes) && job.scenes.length > 0, 'scenes boş olamaz');
  (job.scenes ?? []).forEach((s, i) => {
    req(typeof s.narration === 'string' && s.narration.trim(), `sahne ${i + 1}: narration eksik`);
    req(typeof s.visual?.query === 'string' && s.visual.query.trim(), `sahne ${i + 1}: visual.query eksik`);
    req(typeof s.visual?.prompt === 'string' && s.visual.prompt.trim(), `sahne ${i + 1}: visual.prompt eksik`);
    if (typeof s.narration === 'string') req(countWords(s.narration) <= 90, `sahne ${i + 1}: 90 kelimeden uzun, böl`);
  });

  const slot = needed?.find((n) => n.id === job.id);
  if (slot && Array.isArray(job.scenes)) {
    const words = job.scenes.reduce((sum, s) => sum + countWords(s.narration ?? ''), 0);
    const min = Math.round(slot.targetWords * (1 - WORD_TOLERANCE));
    const max = Math.round(slot.targetWords * (1 + WORD_TOLERANCE));
    req(words >= min && words <= max, `toplam ${words} kelime; hedef ${slot.targetWords} (${min}-${max} arası olmalı)`);
    req(job.type === slot.type && job.channelId === slot.channelId, 'type/channelId needed.json ile uyuşmuyor');
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
