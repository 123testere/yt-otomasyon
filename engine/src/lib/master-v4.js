// Master Prompt v4 (routine/MASTER-v4.md): kapsamdaki kanallarda yayın kapısı.
// Tek kural tutmazsa iş reddedilir (video üretilmez). Bağımlılıksız: rutin npm install olmadan çalıştırır.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.js';

const ayar = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'master-v4.json'), 'utf8')); } catch { return { kanallar: {}, sinirlar: {} }; }
})();
export const V4 = { uzunBaslikMax: 50, shortsBaslikMax: 40, etiketMax: 6, shortsMaxSn: 180, bolumMin: 3, bolumMinSn: 10,
  lufs: -14, tepeDbtp: -1, kapak: [3840, 2160], studioBekleSaat: 24, ...ayar.sinirlar };
export const v4Kanal = (channelId) => Boolean(ayar.kanallar?.[channelId]);

// Bölüm 6 kontrol listesi maddeleri
const ORTAK = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'O11', 'O12'];
const UZUN = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9'];
const SHORTS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const YAYIN = ['Y1', 'Y2', 'Y3', 'Y4'];
export const kontrolMaddeleri = (tip) => [...ORTAK, ...(tip === 'long' ? UZUN : SHORTS), ...YAYIN];

const URL_RE = /^https?:\/\/\S+\.\S+/;
// O6: ödül/çekiliş/koşullu etkileşim
const KOSULLU = /(çekiliş|hediye (ediyoruz|veriyoruz)|kazan(an|ma şansı)|abone ol(un)?,? kazan|sub4sub|giveaway)/i;

export function v4Hatalari(job) {
  if (!v4Kanal(job.channelId) || job.format === 'kesit') return [];
  const e = [];
  const tip = job.type;
  const metin = JSON.stringify(job);

  // 0: doğrulanamayan bilgi işaretliyse yayın yok
  if (/\[DOĞRULANMALI\]/i.test(metin)) e.push('v4 §0: [DOĞRULANMALI] işaretli bilgi var; doğrulanmadan video yayınlanmaz');

  // O3 kaynaklar (kurgu dizi hariç; orada kurgu: true)
  const kurgu = job.format === 'dizi' && job.kurgu === true;
  if (!kurgu) {
    const k = Array.isArray(job.kaynaklar) ? job.kaynaklar : [];
    const gecerli = k.filter((x) => URL_RE.test(typeof x === 'string' ? x : x?.url ?? ''));
    if (!gecerli.length) e.push('v4 O3: "kaynaklar": [{ url, not }] en az bir açılan kaynak bağlantısı olmalı (kurgu dizi bölümüyse "kurgu": true)');
  }
  // O6 koşullu etkileşim
  if (KOSULLU.test([job.title, job.description, ...(job.scenes ?? []).map((s) => s.narration ?? '')].join(' '))) e.push('v4 O6: ödül/çekiliş/koşullu etkileşim yasak');
  // O12 etiketler
  if (Array.isArray(job.tags) && job.tags.length > V4.etiketMax) e.push(`v4 O12: en fazla ${V4.etiketMax} alakalı etiket (${job.tags.length} var)`);

  if (tip === 'long') {
    // U2 başlık uzunluğu, U1 üç başlık
    if ((job.title ?? '').length > V4.uzunBaslikMax) e.push(`v4 U2: uzun video başlığı en fazla ${V4.uzunBaslikMax} karakter (${job.title.length})`);
    const b = Array.isArray(job.basliklar) ? job.basliklar.filter((x) => typeof x === 'string' && x.trim()) : [];
    if (b.length !== 3 || new Set(b.map((x) => x.trim().toLowerCase())).size !== 3) e.push('v4 U1: "basliklar": 3 farklı başlık olmalı (A/B testi; ilki title ile aynı olabilir)');
    for (const x of b) if (x.length > V4.uzunBaslikMax) e.push(`v4 U1/U2: "${x}" ${x.length} karakter; en fazla ${V4.uzunBaslikMax}`);
    // U1 üç kapak yazısı (thumbnailText + thumbnailTextAlt + thumbnailTextAlt2)
    if (![job.thumbnailText, job.thumbnailTextAlt, job.thumbnailTextAlt2].every((x) => typeof x === 'string' && x.trim())) e.push('v4 U1: 3 kapak yazısı olmalı (thumbnailText, thumbnailTextAlt, thumbnailTextAlt2)');
    // U6 bölümler: en az 3, ilki ilk sahnede
    if (Array.isArray(job.scenes) && job.format !== 'dizi') {
      const bolumler = job.scenes.filter((s) => s.bolum);
      if (bolumler.length < V4.bolumMin) e.push(`v4 U6: en az ${V4.bolumMin} bölüm başlığı olmalı (sahnelerde "bolum")`);
      if (!job.scenes[0]?.bolum) e.push('v4 U6: ilk bölüm 00:00\'da başlamalı (ilk sahnede "bolum")');
    }
    // U9 oynatma listesi
    if (!(typeof job.oynatmaListesi === 'string' && job.oynatmaListesi.trim())) e.push('v4 U9: "oynatmaListesi" zorunlu (konuya uygun liste)');
  } else {
    // S6 başlık, S4 ilgili video
    if ((job.title ?? '').length > V4.shortsBaslikMax) e.push(`v4 S6: Shorts başlığı en fazla ${V4.shortsBaslikMax} karakter (${job.title.length})`);
    if (!(typeof job.ilgiliVideo === 'string' && job.ilgiliVideo.trim())) e.push('v4 S4: "ilgiliVideo" zorunlu (ilgili uzun videonun iş kimliği ya da YouTube adresi); son 5 sn\'deki tek çağrı ona yönlendirir');
  }

  // Bölüm 6 kontrol listesi: her madde "evet: nasıl"
  const k = job.kontrol && typeof job.kontrol === 'object' ? job.kontrol : null;
  if (!k) e.push('v4 §6: "kontrol" listesi yok (her madde için "evet: nasıl")');
  else {
    const eksik = kontrolMaddeleri(tip).filter((m) => !/^evet\b/i.test(String(k[m] ?? '').trim()));
    if (eksik.length) e.push(`v4 §6: kontrol listesinde "evet" olmayan/eksik maddeler: ${eksik.join(', ')}`);
  }
  return e;
}

// Render sonrası (U6): bölüm zamanları — ilki 0, en az 3, her biri en az 10 sn
export function bolumZamanHatalari(zamanlar, toplamSn) {
  if (!Array.isArray(zamanlar) || zamanlar.length < V4.bolumMin) return [`v4 U6: ${zamanlar?.length ?? 0} bölüm; en az ${V4.bolumMin}`];
  const e = [];
  if (zamanlar[0] !== 0) e.push('v4 U6: ilk bölüm 00:00 olmalı');
  const sonlar = [...zamanlar.slice(1), toplamSn];
  zamanlar.forEach((t, i) => { if (sonlar[i] - t < V4.bolumMinSn) e.push(`v4 U6: ${i + 1}. bölüm ${Math.round(sonlar[i] - t)} sn; en az ${V4.bolumMinSn}`); });
  return e;
}

// Vice City Dispatch (klip kampanyaları): v4'ün özgünlük/kalite maddeleri (O1–O12, S1–S3, S6) + bizim yorumumuz zorunlu.
// S4 (ilgili uzun video) ve S5 (Shorts oranı) kullanıcı kararıyla uygulanmaz (kanalda uzun video yok, kampanya Shorts'la ölçülür).
export const KESIT_KONTROL = [...ORTAK, 'S1', 'S2', 'S3', 'S6'];
export function kesitYorumHatalari(job) {
  const e = [];
  const x = job.ekran;
  const sure = Number(job.kaynak?.sure) || null;
  if (!x || typeof x !== 'object') return ['v4 O1: kendi yorumumuz yok — "ekran": { baglam, isaretler: [{ sn, metin, x?, y? }], analiz: { metin } } yazılmalı'];
  if (!(typeof x.baglam === 'string' && x.baglam.trim() && x.baglam.length <= 70)) e.push('ekran.baglam: 1-70 karakter bağlam (klipte ne oluyor, neden önemli)');
  const isr = Array.isArray(x.isaretler) ? x.isaretler : [];
  if (isr.length < 1 || isr.length > 3) e.push('ekran.isaretler: 1-3 "şuna bak" işareti');
  for (const i of isr) {
    if (!(Number(i.sn) >= 0) || (sure && i.sn > sure - 1)) e.push(`ekran.isaretler: sn (${i.sn}) klibin içinde olmalı`);
    if (!(typeof i.metin === 'string' && i.metin.trim() && i.metin.length <= 40)) e.push('ekran.isaretler: metin 1-40 karakter');
    if ((i.x != null || i.y != null) && !(i.x >= 0 && i.x <= 1 && i.y >= 0 && i.y <= 1)) e.push('ekran.isaretler: x, y 0-1 arası (kaynak karesinde)');
  }
  if (!(typeof x.analiz?.metin === 'string' && x.analiz.metin.trim() && x.analiz.metin.length <= 110)) e.push('ekran.analiz.metin: 1-110 karakter "neden patladı" analizi');
  if ((job.title ?? '').length > V4.shortsBaslikMax) e.push(`v4 S6: başlık en fazla ${V4.shortsBaslikMax} karakter (${job.title.length})`);
  if (Array.isArray(job.tags) && job.tags.length > V4.etiketMax) e.push(`v4 O12: en fazla ${V4.etiketMax} etiket`);
  if (/\[DOĞRULANMALI\]/i.test(JSON.stringify(job))) e.push('v4 §0: [DOĞRULANMALI] işaretli bilgi var');
  const k = job.kontrol && typeof job.kontrol === 'object' ? job.kontrol : {};
  const eksik = KESIT_KONTROL.filter((m) => !/^evet\b/i.test(String(k[m] ?? '').trim()));
  if (eksik.length) e.push(`v4 §6: kontrol listesinde "evet" olmayan/eksik: ${eksik.join(', ')}`);
  return e;
}
