// queue/*.json senaryo dosyalarını kontrol eder. Claude rutini push etmeden önce bunu çalıştırır;
// motor da render'dan önce aynı kontrolü yapar. Bağımlılık yok, npm install olmadan çalışır.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONFIG_DIR, DONE_DIR, QUEUE_DIR, ROOT } from './lib/paths.js';
import { KAPAK_ALAN, cizimHatasi } from '../../shared/cizim.js';
import { deneyHatalari } from './lib/deney.js';
import { POZLAR, ESYALAR } from '../../shared/cop.js';
import { IFADELER as DIZI_IFADELER, MEKANLAR, ZAMANLAR, EFEKTLER } from '../../shared/dizi.js';
import { DESTAN_MEKANLAR } from '../../shared/mekan-destan.js';

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
  if (job.type === 'short' && job.kapanis === undefined) errors.push('Shorts\'ta kapanis {a, b} oylama kartı olmalı');
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

// Dizi formatı (Bölüm Bölüm): sahneler kodla çizilir, satırlar karakter sesleriyle okunur.
const DIZI_MEKANLAR = [...DESTAN_MEKANLAR, ...MEKANLAR];
const DIZI_EFEKTLER = [...EFEKTLER, 'agir-cekim', 'beyaz-cakma'];
const DIZI_NESNELER = ['kilic', 'kalkan', 'kirik-kalkan'];
const sayi01 = (v) => typeof v === 'number' && v >= 0 && v <= 1;
const ekranX = (v) => typeof v === 'number' && v >= -0.3 && v <= 1.3; // ekrana girip çıkma
const sn = (v) => typeof v === 'number' && v >= 0 && v <= 60;

function diziYukleGuvenli(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'diziler', `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export const diziSatirlari = (job) => (job?.scenes ?? []).flatMap((s) => s.satirlar ?? []);

function diziErrors(job, slot) {
  const errors = [];
  const dizi = typeof job.dizi === 'string' ? diziYukleGuvenli(job.dizi) : null;
  if (!dizi) return [`dizi bulunamadı: diziler/${job.dizi}.json`];
  const kisiler = new Set(Object.keys(dizi.karakterler ?? {}));
  if (!(Number.isInteger(job.bolum?.no) && job.bolum.no > 0 && str(job.bolum?.ad, 32))) errors.push('bolum {no (tam sayı), ad ≤32} olmalı');
  if (slot?.bolum?.no && job.bolum?.no !== slot.bolum.no) errors.push(`bu ${slot.bolum.no}. bölüm: bolum.no = ${slot.bolum.no} olmalı`);
  if (slot?.dizi && job.dizi !== slot.dizi) errors.push(`bu kanalın dizisi "${slot.dizi}": dizi = "${slot.dizi}" olmalı`);
  const scenes = Array.isArray(job.scenes) ? job.scenes : [];
  if (!scenes.length) errors.push('scenes boş olamaz');
  scenes.forEach((sc, i) => {
    const e = (m) => errors.push(`sahne ${i + 1}: ${m}`);
    if (!DIZI_MEKANLAR.includes(sc.mekan)) e(`mekan şunlardan biri olmalı: ${DIZI_MEKANLAR.join(', ')}`);
    if (sc.zaman !== undefined && !ZAMANLAR.includes(sc.zaman)) e(`zaman şunlardan biri olmalı: ${ZAMANLAR.join(', ')}`);
    if (sc.efektler !== undefined && !(Array.isArray(sc.efektler) && sc.efektler.every((x) => DIZI_EFEKTLER.includes(x)))) e(`efektler şunlardan olmalı: ${DIZI_EFEKTLER.join(', ')}`);
    if (sc.kalabalik !== undefined && !sayi01(sc.kalabalik)) e('kalabalik 0-1 arası sayı olmalı');
    if (sc.kisim !== undefined && !str(sc.kisim, 32)) e('kisim ≤32 karakter olmalı');
    if (sc.kart !== undefined && !(str(sc.kart?.ust, 30) && optStr(sc.kart?.alt, 40))) e('kart {ust ≤30, alt ≤40} olmalı');
    if (sc.sure !== undefined && !(typeof sc.sure === 'number' && sc.sure > 0 && sc.sure <= 12)) e('sure 0-12 sn olmalı');
    if (!optStr(sc.aciklama, 300)) e('aciklama ≤300 karakter');
    const kadraj = Array.isArray(sc.kadraj) ? sc.kadraj : [];
    if (sc.kadraj !== undefined && !Array.isArray(sc.kadraj)) e('kadraj bir dizi olmalı');
    if (kadraj.length > 4) e('kadrajda en fazla 4 karakter olabilir');
    const poz = (p, yer) => { if (p !== undefined && p !== null && !POZLAR.includes(p)) e(`${yer}: poz şunlardan biri olmalı: ${POZLAR.join(', ')}`); };
    const esya = (x, yer) => { if (x !== undefined && x !== null && !ESYALAR.includes(x)) e(`${yer}: esya şunlardan biri olmalı (ya da null): ${ESYALAR.join(', ')}`); };
    const ifade = (x, yer) => { if (x !== undefined && x !== null && !DIZI_IFADELER.includes(x)) e(`${yer}: ifade şunlardan biri olmalı: ${DIZI_IFADELER.join(', ')}`); };
    for (const k of kadraj) {
      const yer = `kadraj "${k?.id}"`;
      if (!kisiler.has(k?.id)) { e(`${yer}: dizide böyle karakter yok (${[...kisiler].join(', ')})`); continue; }
      if (k.x !== undefined && !sayi01(k.x)) e(`${yer}: x 0-1 arası olmalı`);
      if (k.yon !== undefined && ![1, -1].includes(k.yon)) e(`${yer}: yon 1 (sağa bakar) ya da -1 (sola bakar)`);
      poz(k.poz, yer); esya(k.esya, yer); ifade(k.ifade, yer);
      if (k.hareket !== undefined && !(ekranX(k.hareket?.x0) && ekranX(k.hareket?.x1) && (k.hareket.sure === undefined || sn(k.hareket.sure)))) e(`${yer}: hareket {x0, x1 (-0,3 ile 1,3 arası), sure} olmalı`);
      if (k.adimlar !== undefined) {
        if (!Array.isArray(k.adimlar)) e(`${yer}: adimlar bir dizi olmalı`);
        else for (const a of k.adimlar) {
          if (!sn(a?.sn)) e(`${yer}: her adımda sn (sahne başından saniye) olmalı`);
          if (a?.x !== undefined && !sayi01(a.x)) e(`${yer}: adım x 0-1 arası olmalı`);
          poz(a?.poz, yer); esya(a?.esya, yer); ifade(a?.ifade, yer);
        }
      }
    }
    for (const n of sc.nesneler ?? []) {
      if (!DIZI_NESNELER.includes(n?.tip)) e(`nesne tipi şunlardan biri olmalı: ${DIZI_NESNELER.join(', ')}`);
      else if (!sayi01(n.x)) e('nesne x 0-1 arası olmalı');
    }
    if (sc.zincir !== undefined && !(kadraj.some((k) => k.id === sc.zincir?.a) && kadraj.some((k) => k.id === sc.zincir?.b) && sn(sc.zincir?.sn))) {
      e('zincir {a, b (kadrajdaki karakterler), sn} olmalı');
    }
    if (sc.satirlar !== undefined && !Array.isArray(sc.satirlar)) e('satirlar bir dizi olmalı');
    if (!(sc.satirlar?.length) && !sc.sure) e('konuşmasız sahneye sure yaz');
    for (const s of Array.isArray(sc.satirlar) ? sc.satirlar : []) {
      if (s?.kim !== undefined && s.kim !== 'anlatici' && !kisiler.has(s.kim)) e(`satır: kim "${s.kim}" dizide yok`);
      if (!str(s?.metin, 220)) e('satır metni 1-220 karakter olmalı');
      else if (/[<>*_#[\]()]/.test(s.metin)) e('satır metninde < > * _ # [ ] ( ) olamaz (seslendirilir)');
      if (s?.once !== undefined && !(typeof s.once === 'number' && s.once >= 0 && s.once <= 5)) e('satır once 0-5 sn olmalı');
      ifade(s?.ifade, 'satır'); poz(s?.poz, 'satır');
    }
  });
  if (!(str(job.kapanis?.baslik, 20) && optStr(job.kapanis?.sonraki, 50) && optStr(job.kapanis?.soru, 70))) {
    errors.push('kapanis {baslik ≤20, sonraki ≤50, soru ≤70} olmalı');
  }
  if (job.muzikSeviye !== undefined && !(typeof job.muzikSeviye === 'number' && job.muzikSeviye >= 0 && job.muzikSeviye <= 0.3)) errors.push('muzikSeviye 0-0,3 arası');
  const kelime = diziSatirlari(job).reduce((n, s) => n + countWords(String(s?.metin ?? '')), 0);
  if (job.type === 'long') {
    if (!scenes[0]?.kisim) errors.push('ilk sahne bir kısımla başlamalı (ör. "kisim": "Soğuk Açılış")');
    if (scenes.filter((s) => s.kisim).length < 3) errors.push('bölümde en az 3 kısım olmalı (YouTube bölümleri bunlardan çıkar)');
    if (job.kapak !== undefined && !(Number.isInteger(job.kapak?.sahne) && job.kapak.sahne >= 0 && job.kapak.sahne < scenes.length && sn(job.kapak?.sn ?? 0))) {
      errors.push('kapak {sahne (sahne sırası, 0\'dan), sn} olmalı');
    }
    if (job.dikey || job.acilis === false) errors.push('uzun bölümde dikey ve acilis yazma');
  } else {
    if (job.dikey !== true) errors.push('Shorts\'ta "dikey": true olmalı');
    if (job.acilis !== false) errors.push('Shorts\'ta "acilis": false olmalı (ilk saniyeden kanca)');
    if (!(typeof job.hiz === 'number' && job.hiz >= 1 && job.hiz <= 1.2)) errors.push('Shorts\'ta hiz 1-1,2 arası olmalı (önerilen 1,12)');
    if (scenes.length > 10) errors.push(`Shorts'ta ${scenes.length} sahne var; en fazla 10`);
    if (kelime > 130) errors.push(`Shorts'ta ${kelime} kelime var; 60 saniyeyi geçmemesi için en fazla 130`);
  }
  if (slot) {
    const min = Math.round(slot.targetWords * (1 - WORD_TOLERANCE));
    const max = Math.round(slot.targetWords * (1 + WORD_TOLERANCE));
    if (job.type === 'long' && (kelime < min || kelime > max)) errors.push(`satırlarda toplam ${kelime} kelime; hedef ${slot.targetWords} (${min}-${max} arası olmalı)`);
    if (job.type === 'short' && kelime < 40) errors.push(`Shorts'ta ${kelime} kelime; en az 40`);
    if (job.type !== slot.type || job.channelId !== slot.channelId) errors.push('type/channelId needed.json ile uyuşmuyor');
    if (slot.clipOf) {
      if (job.derivedFrom !== slot.clipOf) errors.push(`bu Shorts "${slot.clipOf}" bölümünün kısa hali: derivedFrom = "${slot.clipOf}" olmalı`);
      else {
        const kaynak = findJob(slot.clipOf);
        if (!kaynak) errors.push(`kaynak bölüm bulunamadı: ${slot.clipOf}`);
        else {
          const havuz = new Set(diziSatirlari(kaynak).flatMap((s) => wordsOf(s.metin ?? '')));
          const w = diziSatirlari(job).flatMap((s) => wordsOf(s.metin ?? ''));
          const pay = w.length ? w.filter((x) => havuz.has(x)).length / w.length : 0;
          if (pay < 0.6) errors.push(`Shorts satırlarının yalnızca %${Math.round(pay * 100)}'i bölümden; en az %60 olmalı (bölümün en iyi anlarından kurgula)`);
        }
      }
    }
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

// Optimizasyon alanları (hepsi isteğe bağlı; yazılmışsa biçimi doğru olmalı).
function ekAlanHatalari(job) {
  const errors = [];
  if (job.ceviriler !== undefined) {
    if (!job.ceviriler || typeof job.ceviriler !== 'object' || Array.isArray(job.ceviriler)) {
      errors.push('ceviriler {dil: {title, description}} olmalı');
    } else {
      for (const [dil, c] of Object.entries(job.ceviriler)) {
        if (!/^[a-z]{2}$/.test(dil)) errors.push(`ceviriler: "${dil}" iki harfli dil kodu olmalı`);
        if (!str(c?.title, 100) || /[<>]/.test(c?.title ?? '')) errors.push(`ceviriler.${dil}.title 1-100 karakter olmalı, < > olmadan`);
        if (!str(c?.description, 4500) || /[<>]/.test(c?.description ?? '')) errors.push(`ceviriler.${dil}.description 1-4500 karakter olmalı, < > olmadan`);
      }
    }
  }
  if (!optStr(job.oynatmaListesi, 60) || /[<>]/.test(job.oynatmaListesi ?? '')) errors.push('oynatmaListesi en fazla 60 karakter, < > olmadan');
  if (!optStr(job.thumbnailTextAlt, 40)) errors.push('thumbnailTextAlt en fazla 40 karakter');
  if (!optStr(job.titleAlt, 100) || /[<>]/.test(job.titleAlt ?? '')) errors.push('titleAlt en fazla 100 karakter, < > olmadan');
  return errors;
}

const kelimeSay = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length;

// Yeni yazılan senaryoya (needed.json'daki slot) uygulanan kurallar: kuyruktaki eski işleri geçersiz kılmaz.
function slotHatalari(job, slot) {
  const errors = [...deneyHatalari(job, slot.deney)];
  if (typeof job.title === 'string' && job.title.length > 70) {
    errors.push(`başlık ${job.title.length} karakter; telefonda kesilmemesi için en fazla 70 (ideal 40-60)`);
  }
  // Aramada açıklamanın ilk iki satırı görünür (seri etiketi "Eşyaların Hikayesi #12" gibi kısa bir satır olabilir).
  const ilkIki = String(job.description ?? '').trim().split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
  if (!ilkIki.some((l) => l.length >= 30 && !/^(#|http)/.test(l))) {
    errors.push('açıklamanın ilk iki satırından biri aramada görünen, anahtar kelimeyle başlayan, en az 30 karakterlik bir cümle olmalı');
  }
  if (job.type === 'long') {
    if (kelimeSay(job.thumbnailText) > 4 || String(job.thumbnailText ?? '').length > 25) {
      errors.push('thumbnailText en fazla 4 kelime ve 25 karakter olmalı (küçük ekranda okunmalı)');
    }
    if (!str(job.thumbnailTextAlt, 25) || kelimeSay(job.thumbnailTextAlt) > 4) {
      errors.push('thumbnailTextAlt (yedek kapak yazısı, ≤4 kelime, ≤25 karakter) eksik');
    } else if (job.thumbnailTextAlt.trim().toLocaleLowerCase('tr') === String(job.thumbnailText).trim().toLocaleLowerCase('tr')) {
      errors.push('thumbnailTextAlt asıl kapak yazısından farklı olmalı');
    }
    if (!str(job.titleAlt, 70)) errors.push('titleAlt (yedek başlık, ≤70 karakter) eksik');
    else if (normalizeTitle(job.titleAlt) === normalizeTitle(job.title)) errors.push('titleAlt asıl başlıktan farklı olmalı');
  }
  for (const dil of slot.ceviriDilleri ?? []) {
    if (!job.ceviriler?.[dil]) errors.push(`ceviriler.${dil} eksik: başlık ve açıklamanın ${dil} çevirisi yazılmalı`);
  }
  return errors;
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

  errors.push(...ekAlanHatalari(job));

  if (job.type === 'long') {
    req(typeof job.thumbnailText === 'string' && job.thumbnailText.trim() && job.thumbnailText.length <= 40,
      'thumbnailText 1-40 karakter olmalı');
    if (job.format !== 'cizim' && job.format !== 'dizi') req(typeof job.thumbnailPrompt === 'string' && job.thumbnailPrompt.trim(), 'thumbnailPrompt eksik');
  }

  if (job.format === 'duell') {
    errors.push(...duellErrors(job.duell));
    const slot = needed?.find((n) => n.id === job.id);
    if (slot?.match) {
      req(typeof job.title === 'string' && job.title.startsWith(`Duell ${slot.match}/${slot.total}`),
        `title "Duell ${slot.match}/${slot.total}: …" ile başlamalı`);
    }
    if (slot) errors.push(...deneyHatalari(job, slot.deney));
    return errors;
  }

  if (job.format === 'dizi') {
    const slot = needed?.find((n) => n.id === job.id);
    errors.push(...diziErrors(job, slot));
    if (slot) errors.push(...slotHatalari(job, slot));
    return errors;
  }

  req(Array.isArray(job.scenes) && job.scenes.length > 0, 'scenes boş olamaz');
  if (needed?.find((n) => n.id === job.id)?.format === 'dizi') errors.push('bu kanal dizi formatında: "format": "dizi" olmalı');
  const cizim = job.format === 'cizim';
  if (cizim) errors.push(...cizimErrors(job));
  (job.scenes ?? []).forEach((s, i) => {
    req(typeof s.narration === 'string' && s.narration.trim(), `sahne ${i + 1}: narration eksik`);
    if (cizim) {
      if (typeof s.narration === 'string') req(countWords(s.narration) <= 90, `sahne ${i + 1}: 90 kelimeden uzun, böl`);
      return;
    }
    if (s.bolum !== undefined && !(str(s.bolum?.ad, 32) && optStr(s.bolum?.no, 20))) errors.push(`sahne ${i + 1}: bolum {ad ≤32} olmalı`);
    req(typeof s.visual?.query === 'string' && s.visual.query.trim(), `sahne ${i + 1}: visual.query eksik`);
    req(typeof s.visual?.prompt === 'string' && s.visual.prompt.trim(), `sahne ${i + 1}: visual.prompt eksik`);
    if (typeof s.narration === 'string') req(countWords(s.narration) <= 90, `sahne ${i + 1}: 90 kelimeden uzun, böl`);
    for (const err of motionErrors(s.visual?.motion)) errors.push(`sahne ${i + 1}: ${err}`);
  });

  const slot = needed?.find((n) => n.id === job.id);
  if (slot) errors.push(...slotHatalari(job, slot));
  if (slot && Array.isArray(job.scenes)) {
    const words = job.scenes.reduce((sum, s) => sum + countWords(s.narration ?? ''), 0);
    const min = Math.round(slot.targetWords * (1 - WORD_TOLERANCE));
    const max = Math.round(slot.targetWords * (1 + WORD_TOLERANCE));
    req(words >= min && words <= max, `toplam ${words} kelime; hedef ${slot.targetWords} (${min}-${max} arası olmalı)`);
    req(job.type === slot.type && job.channelId === slot.channelId, 'type/channelId needed.json ile uyuşmuyor');
    if (slot.clipOf) errors.push(...clipErrors(job, slot.clipOf));
    if (slot.format === 'cizim') req(job.format === 'cizim', 'bu kanal çizim formatında: "format": "cizim" olmalı');
    if (slot.oylama) {
      req(job.oylama?.kaynak === slot.oylama.kaynak, `bu video "${slot.oylama.kaynak}" oylamasının konusu: oylama.kaynak yazılmalı`);
      req(['a', 'b'].includes(job.oylama?.secilen), 'oylama.secilen "a" ya da "b" olmalı');
      if (slot.oylama.kazanan) req(job.oylama?.secilen === slot.oylama.kazanan, `oylamayı "${slot.oylama.kazanan}" kazandı; o konuyu yaz`);
    }
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
