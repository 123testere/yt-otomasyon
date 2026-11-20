// queue/*.json senaryo dosyalarını kontrol eder. Claude rutini push etmeden önce bunu çalıştırır;
// motor da render'dan önce aynı kontrolü yapar. Bağımlılık yok, npm install olmadan çalışır.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONFIG_DIR, DONE_DIR, QUEUE_DIR, ROOT } from './lib/paths.js';
import { KAPAK_ALAN, cizimHatasi } from '../../shared/cizim.js';
import { deneyHatalari } from './lib/deney.js';
import { HIZLI_CUMLE, HIZLI_DIZI_HIZ, anlatimMetinleri, cagriEksigi, cumleSay } from './lib/hizli.js';
import { haberLinkleri } from './lib/haberler.js';
import { POZLAR, ESYALAR } from '../../shared/cop.js';
import { IFADELER as DIZI_IFADELER, MEKANLAR, ZAMANLAR, EFEKTLER } from '../../shared/dizi.js';
import { DESTAN_MEKANLAR, mekanKodHatasi } from '../../shared/mekan-destan.js';
import { OYUN_MEKANLAR } from '../../shared/mekan-oyun.js';
import { TEKNO_MEKANLAR } from '../../shared/mekan-tekno.js';
import { kampanyaBul, kampanyaHatalari } from './lib/kampanya.js';

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
function duellErrors(d, hizli = false) {
  if (!d || typeof d !== 'object') return ['duell nesnesi eksik'];
  const errors = [];
  if (!DUELL_TOPIC_IDS.has(d.topicId)) errors.push(`duell.topicId katalogda yok: ${d.topicId}`);
  for (const p of DUELL_PHASES) {
    if (!str(d.script?.[p], 400)) errors.push(`duell.script.${p} eksik veya çok uzun`);
  }
  const words = DUELL_PHASES.reduce((n, p) => n + countWords(d.script?.[p] ?? ''), 0);
  if (hizli) { if (words < 55 || words > 95) errors.push(`duell anlatımı ${words} kelime; hızlı Shorts için 55-95 arası olmalı (her bölüm tek kısa cümle)`); }
  else if (words < 75 || words > 135) errors.push(`duell anlatımı ${words} kelime; 45 sn için 75-135 arası olmalı`);
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
  if (job.type === 'short' && job.kapanis === undefined) errors.push('Shorts\'ta kapanis {a, b} oylama kartı olmalı (ön gösterimde {fragman: true, baslik, alt})');
  if (job.kapanis && !job.kapanis.fragman && !job.kapanis.a && job.kapanis.soru !== undefined) {
    // Kişisel soru kartı (oylama yerine): { soru ≤60, alt ≤30 }
    if (!(str(job.kapanis.soru, 60) && optStr(job.kapanis.alt, 30))) errors.push('kişisel soru kartı kapanis {soru ≤60, alt ≤30} olmalı');
  } else if (job.kapanis?.fragman) {
    if (!(str(job.kapanis.baslik, 22) && optStr(job.kapanis.alt, 30))) errors.push('ön gösterim kartı kapanis {fragman: true, baslik ≤22 (ör. "BU AKŞAM 18:00"), alt ≤30} olmalı');
  } else if (job.kapanis !== undefined && !(str(job.kapanis?.a, 18) && str(job.kapanis?.b, 18) && optStr(job.kapanis?.soru, 30))) {
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
const DIZI_MEKANLAR = [...DESTAN_MEKANLAR, ...MEKANLAR, ...OYUN_MEKANLAR, ...TEKNO_MEKANLAR];
const DIZI_EFEKTLER = [...EFEKTLER, 'agir-cekim', 'beyaz-cakma'];
const DIZI_NESNELER = ['kilic', 'kalkan', 'kirik-kalkan', 'anahtar'];
const MEKAN_DIR = path.join(ROOT, 'mekanlar');
// Senaryo yazarının çizdiği özel mekânlar: mekanlar/<ad>.json (kodu çalışıyorsa geçerli)
export function ozelMekanHatasi(ad) {
  const f = path.join(MEKAN_DIR, `${ad}.json`);
  if (!fs.existsSync(f)) return 'yok';
  try {
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (m.ad !== ad) return `mekanlar/${ad}.json içinde ad "${ad}" olmalı`;
    return mekanKodHatasi(m.kod);
  } catch (e) { return e.message; }
}
const SAYI = { bir: 1, iki: 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6, yedi: 7, sekiz: 8 };
const adKoku = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[^\p{L}]/gu, '');
// "Beş muhafız saldırdı" denince sahnede en az 5 muhafız olmalı (anlatılan ne ise o gösterilir).
export function sayiHatalari(sc, dizi) {
  const errors = [];
  const metin = (sc.satirlar ?? []).map((s) => s?.metin ?? '').join(' ').toLocaleLowerCase('tr');
  for (const [id, def] of Object.entries(dizi.karakterler ?? {})) {
    const kok = adKoku(def.ad);
    if (kok.length < 4) continue;
    const re = new RegExp(`(\\d+|${Object.keys(SAYI).join('|')})\\s+${kok}`, 'gu');
    for (const m of metin.matchAll(re)) {
      const n = Number(m[1]) || SAYI[m[1]];
      if (!(n >= 2 && n <= 8)) continue;
      const var_ = (sc.kadraj ?? []).filter((k) => k?.id === id).length;
      if (var_ < n) errors.push(`anlatımda "${m[0]}" geçiyor ama sahnede ${var_} tane ${def.ad} var: ${n} tanesini kadraja koy (ekranda anlatılan görünmeli)`);
    }
  }
  return errors;
}
const SANIYE_RE = /\d+(,\d+)?\s*[-–]\s*\d+(,\d+)?\s*sn/;
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
    const nSatir = Array.isArray(sc.satirlar) ? sc.satirlar.length : 0;
    if (!DIZI_MEKANLAR.includes(sc.mekan)) {
      const oh = typeof sc.mekan === 'string' && /^[a-z0-9-]{2,40}$/.test(sc.mekan) ? ozelMekanHatasi(sc.mekan) : 'yok';
      if (oh === 'yok') e(`mekan şunlardan biri olmalı: ${DIZI_MEKANLAR.join(', ')} — ya da yeni mekânı mekanlar/${sc.mekan ?? '<ad>'}.json olarak çiz`);
      else if (oh) e(`özel mekân mekanlar/${sc.mekan}.json: ${oh}`);
    }
    if (slot) {
      if (!str(sc.aciklama, 600) || !SANIYE_RE.test(sc.aciklama)) e('aciklama saniye saniye yazılmalı: "0-2,5 sn: … 2,5-4 sn: …" (sahnede kim ne yapıyor, ≤600 karakter)');
      for (const m of sayiHatalari(sc, dizi)) e(m);
    }
    const satirOk = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v < nSatir);
    for (const o of [sc.gecit, sc.kapi, sc.yerKapak, ...(sc.duvarZincir ?? []), ...(sc.nesneler ?? [])]) {
      if (o && (!satirOk(o.satir) || !satirOk(o.bitisSatir))) e(`satir 0-${Math.max(0, nSatir - 1)} arası satır sırası olmalı (zamanı o satırın başından sayılır)`);
    }
    if (sc.gecit !== undefined && !(sayi01(sc.gecit?.x) && (sc.gecit.ac === undefined || typeof sc.gecit.ac === 'number'))) e('gecit {x 0-1, ac (sn)} olmalı');
    for (const ad of ['kapi', 'yerKapak']) if (sc[ad] !== undefined && !(sayi01(sc[ad]?.x) && (sc[ad].ac === undefined || (typeof sc[ad].ac === 'number' && sc[ad].ac <= 60)) && (sc[ad].sure === undefined || (sc[ad].sure > 0 && sc[ad].sure <= 6)))) e(`${ad} {x 0-1, ac (sn; eksi = sahne başında zaten açık), sure ≤6} olmalı`);
    if (sc.duvarZincir !== undefined && !(Array.isArray(sc.duvarZincir) && sc.duvarZincir.every((z) => (sc.kadraj ?? []).some((k) => k.id === z?.id) && sayi01(z.x) && sayi01(z.y)))) e('duvarZincir [{id (kadrajdaki karakter), x 0-1, y 0-1, sn, bitis}] olmalı');
    if (sc.zaman !== undefined && !ZAMANLAR.includes(sc.zaman)) e(`zaman şunlardan biri olmalı: ${ZAMANLAR.join(', ')}`);
    if (sc.efektler !== undefined && !(Array.isArray(sc.efektler) && sc.efektler.every((x) => DIZI_EFEKTLER.includes(x)))) e(`efektler şunlardan olmalı: ${DIZI_EFEKTLER.join(', ')}`);
    if (sc.kalabalik !== undefined && !sayi01(sc.kalabalik)) e('kalabalik 0-1 arası sayı olmalı');
    if (sc.kisim !== undefined && !str(sc.kisim, 32)) e('kisim ≤32 karakter olmalı');
    if (sc.kart !== undefined && !(str(sc.kart?.ust, 30) && optStr(sc.kart?.alt, 40))) e('kart {ust ≤30, alt ≤40} olmalı');
    if (sc.sure !== undefined && !(typeof sc.sure === 'number' && sc.sure > 0 && sc.sure <= 12)) e('sure 0-12 sn olmalı');
    if (!optStr(sc.aciklama, 300)) e('aciklama ≤300 karakter');
    if (sc.buyukYazi !== undefined && !(str(sc.buyukYazi?.ust, 14) && optStr(sc.buyukYazi?.alt, 30))) e('buyukYazi {ust ≤14, alt ≤30} olmalı');
    if (sc.sira !== undefined && !(Number.isInteger(sc.sira?.no) && sc.sira.no >= 1 && sc.sira.no <= 10 && str(sc.sira?.ad, 28) && optStr(sc.sira?.tur, 30)
      && (sc.sira.maddeler === undefined || (Array.isArray(sc.sira.maddeler) && sc.sira.maddeler.length <= 3 && sc.sira.maddeler.every((m) => str(m, 24)))))) {
      e('sira {no 1-10, ad ≤28, tur ≤30, maddeler: en fazla 3 madde, her biri ≤24} olmalı');
    }
    if (sc.haber !== undefined && !(str(sc.haber?.baslik, 70) && optStr(sc.haber?.etiket, 22) && optStr(sc.haber?.kaynak, 40)
      && (sc.haber.maddeler === undefined || (Array.isArray(sc.haber.maddeler) && sc.haber.maddeler.length <= 3 && sc.haber.maddeler.every((m) => str(m, 30)))))) {
      e('haber {baslik ≤70, etiket ≤22, kaynak ≤40, maddeler: en fazla 3 madde, her biri ≤30} olmalı');
    }
    if (sc.veri !== undefined && !(Array.isArray(sc.veri) && sc.veri.length >= 2 && sc.veri.length <= 8 && sc.veri.every((v) => typeof v === 'number' && v > 0))) e('veri 2-8 pozitif sayı olmalı');
    const kadraj = Array.isArray(sc.kadraj) ? sc.kadraj : [];
    if (sc.kadraj !== undefined && !Array.isArray(sc.kadraj)) e('kadraj bir dizi olmalı');
    if (kadraj.length > 8) e('kadrajda en fazla 8 karakter olabilir');
    const poz = (p, yer) => { if (p !== undefined && p !== null && !POZLAR.includes(p)) e(`${yer}: poz şunlardan biri olmalı: ${POZLAR.join(', ')}`); };
    const esya = (x, yer) => { if (x !== undefined && x !== null && !ESYALAR.includes(x)) e(`${yer}: esya şunlardan biri olmalı (ya da null): ${ESYALAR.join(', ')}`); };
    const ifade = (x, yer) => { if (x !== undefined && x !== null && !DIZI_IFADELER.includes(x)) e(`${yer}: ifade şunlardan biri olmalı: ${DIZI_IFADELER.join(', ')}`); };
    for (const k of kadraj) {
      const yer = `kadraj "${k?.id}"`;
      if (!kisiler.has(k?.id)) { e(`${yer}: dizide böyle karakter yok (${[...kisiler].join(', ')})`); continue; }
      if (k.x !== undefined && !ekranX(k.x)) e(`${yer}: x -0,3 ile 1,3 arası olmalı (0-1 ekranda; dışı, ekrana girip çıkan karakter)`);
      if (k.yon !== undefined && ![1, -1].includes(k.yon)) e(`${yer}: yon 1 (sağa bakar) ya da -1 (sola bakar)`);
      poz(k.poz, yer); esya(k.esya, yer); ifade(k.ifade, yer);
      if (k.hareket !== undefined && !(ekranX(k.hareket?.x0) && ekranX(k.hareket?.x1) && (k.hareket.sure === undefined || sn(k.hareket.sure)) && (k.hareket.bas === undefined || sn(k.hareket.bas)))) e(`${yer}: hareket {x0, x1 (-0,3 ile 1,3 arası), sure, bas} olmalı`);
      if (k.arka !== undefined && typeof k.arka !== 'boolean') e(`${yer}: arka true/false olmalı`);
      if (k.adimlar !== undefined) {
        if (!Array.isArray(k.adimlar)) e(`${yer}: adimlar bir dizi olmalı`);
        else for (const a of k.adimlar) {
          if (!sn(a?.sn)) e(`${yer}: her adımda sn (sahne başından ya da satir verilmişse o satırın başından saniye) olmalı`);
          if (a?.satir !== undefined && !(Number.isInteger(a.satir) && a.satir >= 0 && a.satir < nSatir)) e(`${yer}: adım satir 0-${Math.max(0, nSatir - 1)} arası satır sırası olmalı`);
          if (a?.x !== undefined && !ekranX(a.x)) e(`${yer}: adım x -0,3 ile 1,3 arası olmalı`);
          if (a?.sure !== undefined && !(a.sure > 0 && a.sure <= 8)) e(`${yer}: adım sure 0-8 sn olmalı`);
          poz(a?.poz, yer); esya(a?.esya, yer); ifade(a?.ifade, yer);
        }
      }
    }
    for (const n of sc.nesneler ?? []) {
      if (!DIZI_NESNELER.includes(n?.tip)) e(`nesne tipi şunlardan biri olmalı: ${DIZI_NESNELER.join(', ')}`);
      else if (!sayi01(n.x)) e('nesne x 0-1 arası olmalı');
    }
    if (sc.zincir !== undefined && !(kadraj.some((k) => k.id === sc.zincir?.a) && kadraj.some((k) => k.id === sc.zincir?.b) && sn(sc.zincir?.sn) && [undefined, 'arka'].includes(sc.zincir?.el))) {
      e('zincir {a, b (kadrajdaki karakterler), sn, el: "arka" (boştaki eller)} olmalı');
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
  // Bölüm tanıtımı: açılışta "BU BÖLÜMDE" maddeleri (yeni senaryolarda zorunlu)
  if (job.tanitim !== undefined && !(Array.isArray(job.tanitim) && job.tanitim.length >= 2 && job.tanitim.length <= 4 && job.tanitim.every((m) => str(m, 28)))) errors.push('tanitim 2-4 madde, her biri ≤28 karakter olmalı (ör. ["Zindandan kaçış", "Su altından kaçış"])');
  if (slot && job.tanitim === undefined && !job.fragman) errors.push('tanitim yaz: bölümde olacakları 2-4 kısa maddeyle tanıt (ör. ["Zindandan kaçış", "Su altından kaçış", "Kapalı çıkış"]); sonunu verme');
  if (job.muzikSeviye !== undefined && !(typeof job.muzikSeviye === 'number' && job.muzikSeviye >= 0 && job.muzikSeviye <= 0.3)) errors.push('muzikSeviye 0-0,3 arası');
  const kelime = diziSatirlari(job).reduce((n, s) => n + countWords(String(s?.metin ?? '')), 0);
  if (job.type === 'long') {
    if (!scenes[0]?.kisim) errors.push('ilk sahne bir kısımla başlamalı (ör. "kisim": "Soğuk Açılış")');
    if (scenes.filter((s) => s.kisim).length < 3) errors.push('bölümde en az 3 kısım olmalı (YouTube bölümleri bunlardan çıkar)');
    if (job.kapak !== undefined && !(Number.isInteger(job.kapak?.sahne) && job.kapak.sahne >= 0 && job.kapak.sahne < scenes.length && sn(job.kapak?.sn ?? 0))) {
      errors.push('kapak {sahne (sahne sırası, 0\'dan), sn} olmalı');
    }
    if (job.dikey) errors.push('uzun bölümde dikey yazma');
  } else {
    if (job.dikey !== true) errors.push('Shorts\'ta "dikey": true olmalı');
    if (job.acilis !== false) errors.push('Shorts\'ta "acilis": false olmalı (ilk saniyeden kanca)');
    if (slot?.hizli) {
      if (!(typeof job.hiz === 'number' && job.hiz >= HIZLI_DIZI_HIZ.min && job.hiz <= HIZLI_DIZI_HIZ.max)) errors.push(`hızlı Shorts'ta hiz ${HIZLI_DIZI_HIZ.min}-${HIZLI_DIZI_HIZ.max} arası olmalı (önerilen 1,2)`);
    } else if (!(typeof job.hiz === 'number' && job.hiz >= 1 && job.hiz <= HIZLI_DIZI_HIZ.max)) errors.push('Shorts\'ta hiz 1-1,3 arası olmalı');
    if (scenes.length > 10) errors.push(`Shorts'ta ${scenes.length} sahne var; en fazla 10`);
    if (kelime > 130) errors.push(`Shorts'ta ${kelime} kelime var; 60 saniyeyi geçmemesi için en fazla 130`);
  }
  if (slot) {
    const min = Math.round(slot.targetWords * (1 - WORD_TOLERANCE));
    const max = Math.round(slot.targetWords * (1 + WORD_TOLERANCE));
    if (job.type === 'long' && (kelime < min || kelime > max)) errors.push(`satırlarda toplam ${kelime} kelime; hedef ${slot.targetWords} (${min}-${max} arası olmalı)`);
    if (job.type === 'short' && slot.hizli) {
      if (kelime < min || kelime > max) errors.push(`Shorts satırlarında ${kelime} kelime; hızlı Shorts hedefi ${slot.targetWords} (${min}-${max} arası olmalı)`);
      if (scenes.length > 7) errors.push(`hızlı Shorts'ta ${scenes.length} sahne var; en fazla 7`);
      if (!(scenes[0]?.buyukYazi || scenes[0]?.sira || scenes[0]?.haber)) errors.push('hızlı Shorts: ilk sahnede sorunu/soruyu bildiren dev yazı olmalı (buyukYazi {ust ≤14, alt ≤30})');
    } else if (job.type === 'short' && kelime < 40) errors.push(`Shorts'ta ${kelime} kelime; en az 40`);
    if (job.type !== slot.type || job.channelId !== slot.channelId) errors.push('type/channelId needed.json ile uyuşmuyor');
    if (slot.fragman && job.fragman !== true) errors.push('bu Shorts gelecek bölümün fragmanı: "fragman": true yaz ve bölümün sonunu verme');
    if (slot.clipOf) {
      if (job.derivedFrom !== slot.clipOf) errors.push(`bu Shorts "${slot.clipOf}" bölümünün ${slot.fragman ? 'fragmanı' : 'kısa hali'}: derivedFrom = "${slot.clipOf}" olmalı`);
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
  // Yeniden üretilen iş (yeniden-uret.js): kendi eski yüklemesinin başlığı "kullanılmış" sayılmaz
  if (excludeId) {
    for (const dir of [QUEUE_DIR, DONE_DIR]) {
      const f = path.join(dir, `${excludeId}.json`);
      if (!fs.existsSync(f)) continue;
      try { titles.delete(normalizeTitle(JSON.parse(fs.readFileSync(f, 'utf8')).title)); } catch { /* yok say */ }
      break;
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
  if (!optStr(job.thumbnailTextAlt2, 40)) errors.push('thumbnailTextAlt2 en fazla 40 karakter');
  if (!optStr(job.rozet, 32)) errors.push('rozet (ekrandaki seri rozeti, ör. "Markaların Hikâyesi #3") en fazla 32 karakter');
  if (!optStr(job.titleAlt, 100) || /[<>]/.test(job.titleAlt ?? '')) errors.push('titleAlt en fazla 100 karakter, < > olmadan');
  return errors;
}

const kelimeSay = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length;

// Hızlı Shorts (slot.hizli): 4-5 cümle, son cümlede abone/beğen çağrısı. Uzun video: anlatımda abone/beğen çağrısı.
// Derleme (sahnesiz) ve duell (kendi kontrolü var) hariç.
// İzleyiciyi ilk saniyede kaçıran açılışlar (selam, tanıtım, "biliyor muydunuz", "bugün … anlatacağım")
const YASAK_ACILIS = /^(merhaba|selam|hoş ?geldin|iyi akşamlar|bugün (size|sizlere|sana|bu videoda)|bu videoda|biliyor muydunuz|biliyor musunuz|did you know|hello|hi everyone|hallo|today we)/i;
const YASAK_CUMLE = /bugün[^.!?]{0,60}(anlatacağım|anlatıyorum|anlatacağız|konuşacağız|bakacağız)/i;

export function cagriHatalari(job, slot) {
  if (job.format === 'duell' || !Array.isArray(job.scenes)) return [];
  const metinler = anlatimMetinleri(job).filter((m) => m.trim());
  if (!metinler.length) return [];
  const errors = [];
  if (YASAK_ACILIS.test(metinler[0].trim())) errors.push('ilk cümle selam/tanıtım/"biliyor muydunuz" ile başlayamaz: doğrudan hikâyenin şaşırtıcı anından ya da sonuçtan başla');
  const ilk3 = metinler.slice(0, 3).join(' ');
  if (YASAK_CUMLE.test(ilk3)) errors.push('girişte "bugün … anlatacağım" gibi tanıtım cümlesi olmaz: anlatmaya doğrudan başla');
  if (job.format === 'cizim' && job.type === 'long') {
    const uzun = job.scenes.slice(0, 6).map((s, i) => [i, kelimeSay(s.narration)]).filter(([, n]) => n > 10);
    if (uzun.length) errors.push(`ilk 15 sn'de görüntü 2-3 sn'de bir değişmeli: ilk 6 sahnenin her biri en fazla 10 kelime (uzun olanlar: ${uzun.map(([i, n]) => `sahne ${i + 1}: ${n}`).join(', ')})`);
  }
  if (job.type === 'short' && slot.hizli && slot.dongu) {
    // Döngü: son cümle veda etmez; ekrandaki kartta abone/beğen zaten yazar
    const cumle = metinler.reduce((n, m) => n + cumleSay(m), 0);
    if (cumle < HIZLI_CUMLE.min || cumle > HIZLI_CUMLE.max) errors.push(`hızlı Shorts: anlatım ${cumle} cümle; 4-5 cümle olmalı`);
    if (/abone|takip|beğen|subscri|follow/i.test(metinler.at(-1))) errors.push('döngülü Shorts: son cümle veda/çağrı içermez, ilk cümleye bağlanır (izleyici fark etmeden başa sarsın)');
    return errors;
  }
  if (job.type === 'short' && slot.hizli) {
    const cumle = metinler.reduce((n, m) => n + cumleSay(m), 0);
    if (cumle < HIZLI_CUMLE.min || cumle > HIZLI_CUMLE.max) {
      errors.push(`hızlı Shorts: anlatım ${cumle} cümle; 4-5 cümle olmalı (sorun → çözüm → çağrı; en fazla ${HIZLI_CUMLE.max})`);
    }
    const c = cagriEksigi(metinler.slice(-2).join(' '), slot.dil);
    if (c) errors.push(`hızlı Shorts: son cümlede ${c} ("Serinin devamı için abone ol ve beğen" benzeri, kanal dilinde)`);
  }
  if (job.type === 'long') {
    const c = cagriEksigi(metinler.join(' '), slot.dil);
    if (c) errors.push(`uzun video: anlatımda ${c} (ilk üçte birde kısa bir çağrı, kapanışta "serinin devamı için abone ol ve beğen")`);
  }
  return errors;
}

// Yeni yazılan senaryoya (needed.json'daki slot) uygulanan kurallar: kuyruktaki eski işleri geçersiz kılmaz.
function slotHatalari(job, slot, { haberKontrol = false } = {}) {
  const errors = [...deneyHatalari(job, slot.deney)];
  // Haber kanalı: video, haber listesindeki gerçek bir habere dayanmalı (uydurma haber olmasın).
  if (slot.haberAkisi) {
    if (!/^https?:\/\/\S+$/.test(job.kaynakLink ?? '') || !str(job.kaynak, 40)) {
      errors.push(`haber kanalı: kaynak (site adı) ve kaynakLink (haberin bağlantısı) yazılmalı; haberi config/haberler-${slot.haberAkisi}.json listesinden seç`);
    } else if (haberKontrol) {
      const linkler = haberLinkleri(slot.haberAkisi);
      if (linkler && !linkler.has(job.kaynakLink)) errors.push(`kaynakLink config/haberler-${slot.haberAkisi}.json listesinde yok; listedeki bir haberi seç ve bağlantıyı aynen kopyala`);
    }
  }
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
    // 3 kapak testi: her uzun video üç farklı kapak yazısıyla denenir, en çok tıklanan kalır.
    const kucuk = (v) => String(v ?? '').trim().toLocaleLowerCase('tr');
    if (!str(job.thumbnailTextAlt2, 25) || kelimeSay(job.thumbnailTextAlt2) > 4) {
      errors.push('thumbnailTextAlt2 (üçüncü kapak yazısı, ≤4 kelime, ≤25 karakter) eksik: 3 kapak testi için üç farklı açı yaz');
    } else if ([kucuk(job.thumbnailText), kucuk(job.thumbnailTextAlt)].includes(kucuk(job.thumbnailTextAlt2))) {
      errors.push('thumbnailTextAlt2 diğer iki kapak yazısından farklı olmalı');
    }
    if (!str(job.titleAlt, 70)) errors.push('titleAlt (yedek başlık, ≤70 karakter) eksik');
    else if (normalizeTitle(job.titleAlt) === normalizeTitle(job.title)) errors.push('titleAlt asıl başlıktan farklı olmalı');
  }
  errors.push(...cagriHatalari(job, slot));
  if (slot.seri) {
    const beklenen = `${slot.seri.ad} #${slot.seri.no}`;
    if (job.seri !== slot.seri.id) errors.push(`bu video "${slot.seri.ad}" serisinin ${slot.seri.no}. bölümü: "seri": "${slot.seri.id}" yaz ve konuyu o seriden seç`);
    if (job.rozet !== beklenen) errors.push(`ekran rozeti "rozet": "${beklenen}" olmalı`);
    if (job.type === 'long' && job.oynatmaListesi !== slot.seri.ad) errors.push(`oynatmaListesi "${slot.seri.ad}" olmalı`);
  }
  for (const dil of slot.ceviriDilleri ?? []) {
    if (!job.ceviriler?.[dil]) errors.push(`ceviriler.${dil} eksik: başlık ve açıklamanın ${dil} çevirisi yazılmalı`);
  }
  return errors;
}

export function validateJob(job, { fileId, needed, takenTitles, haberKontrol = false } = {}) {
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

  // Yayın kesiti (Vice City Dispatch): anlatımsız/az anlatımlı kurgu; kendi kuralları
  if (job.format === 'kesit') return [...errors, ...kesitHatalari(job)];

  errors.push(...ekAlanHatalari(job));

  if (job.type === 'long') {
    req(typeof job.thumbnailText === 'string' && job.thumbnailText.trim() && job.thumbnailText.length <= 40,
      'thumbnailText 1-40 karakter olmalı');
    if (job.format !== 'cizim' && job.format !== 'dizi') req(typeof job.thumbnailPrompt === 'string' && job.thumbnailPrompt.trim(), 'thumbnailPrompt eksik');
  }

  if (job.format === 'duell') {
    const slot = needed?.find((n) => n.id === job.id);
    errors.push(...duellErrors(job.duell, Boolean(slot?.hizli)));
    if (slot?.hizli) {
      const c = cagriEksigi(job.duell?.script?.table, slot.dil);
      if (c) errors.push(`duell.script.table: ${c} (son cümle "Abonniere und like für das nächste Duell" benzeri olmalı)`);
    }
    if (slot?.match) {
      req(typeof job.title === 'string' && job.title.startsWith(`Duell ${slot.match}/${slot.total}`),
        `title "Duell ${slot.match}/${slot.total}: …" ile başlamalı`);
    }
    if (slot) errors.push(...deneyHatalari(job, slot.deney));
    return errors;
  }

  if (job.format === 'dizi' && (Array.isArray(job.derleme) || needed?.find((n) => n.id === job.id)?.derleme)) {
    // Haftalık derleme: sahneler motor tarafından bölümlerden kurulur; sadece yayın bilgileri kontrol edilir
    const slot = needed?.find((n) => n.id === job.id);
    if (!Array.isArray(job.derleme) || job.derleme.length < 2) errors.push('derleme: birleştirilecek bölüm id listesi (en az 2) olmalı');
    else {
      if (slot?.derleme && JSON.stringify(job.derleme) !== JSON.stringify(slot.derleme)) errors.push(`derleme needed.json'daki listeyle aynı olmalı: ${JSON.stringify(slot.derleme)}`);
      for (const id of job.derleme) if (!findJob(id)) errors.push(`derlemedeki bölüm bulunamadı: ${id}`);
    }
    if (job.scenes !== undefined) errors.push('derlemede scenes yazma (bölümlerden otomatik kurulur)');
    if (typeof job.dizi !== 'string') errors.push('dizi eksik');
    if (job.type !== 'long') errors.push('derleme uzun video olmalı');
    if (slot) errors.push(...slotHatalari(job, slot, { haberKontrol }));
    return errors;
  }
  if (job.format === 'dizi') {
    const slot = needed?.find((n) => n.id === job.id);
    errors.push(...diziErrors(job, slot));
    if (slot) errors.push(...slotHatalari(job, slot, { haberKontrol }));
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
  if (slot) errors.push(...slotHatalari(job, slot, { haberKontrol }));
  if (slot && Array.isArray(job.scenes)) {
    const words = job.scenes.reduce((sum, s) => sum + countWords(s.narration ?? ''), 0);
    const min = Math.round(slot.targetWords * (1 - WORD_TOLERANCE));
    const max = Math.round(slot.targetWords * (1 + WORD_TOLERANCE));
    req(words >= min && words <= max, `toplam ${words} kelime; hedef ${slot.targetWords} (${min}-${max} arası olmalı)`);
    req(job.type === slot.type && job.channelId === slot.channelId, 'type/channelId needed.json ile uyuşmuyor');
    if (slot.clipOf) errors.push(...clipErrors(job, slot.clipOf));
    if (slot.fragman && job.fragman !== true) errors.push(`bu Shorts uzun videonun ön gösterimi (uzun videodan önce yayınlanır): "fragman": true yaz, en çarpıcı anı göster, sonucu verme, son cümlede "Tamamı ${slot.uzunSaat ?? 'bu akşam'} kanalda" de`);
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
      errors = validateJob(job, { fileId: f.slice(0, -5), needed, takenTitles, haberKontrol: true });
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

// Yayın kesiti senaryosu: kaynak (izinli yayın), aralık en fazla 58 sn, kısa kanca; kampanya kuralları.
export function kesitHatalari(job) {
  const e = [];
  const k = job.kaynak;
  if (job.type !== 'short') e.push('kesit yalnız Shorts olur');
  if (!k || typeof k !== 'object') return [...e, 'kaynak eksik'];
  if (!/^https?:\/\//.test(k.url ?? '')) e.push('kaynak.url eksik');
  if (!k.yayinci || !k.platform) e.push('kaynak.yayinci ve kaynak.platform gerekli');
  if (k.bas != null || k.son != null) {
    if (!(Number(k.son) > Number(k.bas) && Number(k.bas) >= 0)) e.push('kaynak.bas < kaynak.son olmalı');
    else if (k.son - k.bas > 58) e.push('kesit en fazla 58 sn olmalı');
  }
  if (typeof job.hook !== 'string' || !job.hook.trim() || job.hook.length > 70) e.push('hook 1-70 karakter olmalı');
  for (const y of job.yorum ?? []) if (typeof y?.metin !== 'string' || !(Number(y.sn) >= 0)) e.push('yorum: [{sn, metin}] olmalı');
  if (job.kampanya) e.push(...kampanyaHatalari(job, kampanyaBul(job.kampanya)));
  return e;
}
