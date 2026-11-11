// Haftalık A/B deneyleri (shared/deneyler.json): her kanalda aynı anda tek değişken denenir.
// Planlayıcı videoları sırayla A ve B koluna dağıtır, senkronizasyon yeterli veri gelince sonucu yazar.
// Bağımlılıksızdır (planlayıcı ve doğrulayıcı bulut rutininde npm install olmadan çalışır).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';
import { options } from './options.js';

export const DENEYLER = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'deneyler.json'), 'utf8'));
export const deneyBul = (id) => DENEYLER.find((d) => d.id === id);

export const KOL_BASINA = 3; // her kolda en az bu kadar olgun (7 günlük verisi tamam) video
const SURE_SINIRI_GUN = { short: 21, long: 56 };
const FARK_ESIGI = { izlenme7: 0.25 }; // izlenme gürültülü; diğerleri için %10
const VARSAYILAN_ESIK = 0.1;

const formatOf = (settings) => (settings.contentFormat === 'flaggenduell' ? 'duell' : settings.contentFormat ?? 'belgesel');

// Kanalda hangi tür videoda deney yapılır: Shorts varsa Shorts (daha çok video, daha hızlı sonuç), yoksa uzun video.
export function deneyTipi(settings) {
  if (settings.shorts?.times?.length) return 'short';
  if (settings.long?.days?.length) return 'long';
  return null;
}

export function kisikSes(volume) {
  const list = options.musicVolumes.map((v) => v.id);
  const i = list.indexOf(String(volume));
  return i > 0 ? list[i - 1] : null;
}

export const altSaat = (time) => (Number(String(time).slice(0, 2)) >= 15 ? '12:00' : '19:00');

export function uygunMu(deney, settings, tip) {
  if (!deney.tipler.includes(tip) || deney.formatHaric.includes(formatOf(settings))) return false;
  if (deney.id === 'muzik-seviye') return settings.music !== 'yok' && Boolean(kisikSes(settings.musicVolume));
  if (deney.id === 'yayin-saati') return settings.shorts.times.length === 1;
  return true;
}

// Sıradaki deney: daha önce hiç denenmemiş uygun olanlar katalog sırasıyla; hepsi denendiyse en eski denenen.
export function sonrakiDeney(settings, gecmis = []) {
  const tip = deneyTipi(settings);
  if (!tip) return null;
  const uygun = DENEYLER.filter((d) => uygunMu(d, settings, tip));
  if (!uygun.length) return null;
  const sonDeneme = (id) => Math.max(-1, ...gecmis.map((g, i) => (g.id === id ? i : -1)));
  const secilen = [...uygun].sort((a, b) => sonDeneme(a.id) - sonDeneme(b.id))[0];
  return { id: secilen.id, tip };
}

// Üretimde B kolunun motor ayarı (müzik seviyesi). Süre ve saat planlayıcıda uygulanır.
export function deneyAyari(job, settings) {
  if (job.deney?.id === 'muzik-seviye' && job.deney.kol === 'B') {
    const v = kisikSes(settings.musicVolume);
    if (v) return { ...settings, musicVolume: v };
  }
  return settings;
}

// B kolu kazandıysa kalıcı ayar değişikliği (motor deneyleri). İçerik deneyleri ders olarak senaryo yazarına gider.
export function kazananAyari(id, settings) {
  if (id === 'sure-kisa') return { 'settings.shorts.seconds': Math.max(15, Math.round((settings.shorts.seconds * 0.75) / 5) * 5) };
  if (id === 'muzik-seviye') { const v = kisikSes(settings.musicVolume); return v ? { 'settings.musicVolume': v } : null; }
  if (id === 'yayin-saati') return { 'settings.shorts.times': [altSaat(settings.shorts.times[0])] };
  return null;
}

const ilkCumle = (job) => {
  // Dizi formatında ilk konuşma satırı (anlatıcı ya da karakter) kancadır
  const text = job.format === 'duell' ? job.duell?.script?.intro ?? ''
    : job.format === 'dizi' ? job.scenes?.flatMap((s) => s.satirlar ?? [])[0]?.metin ?? ''
      : job.scenes?.[0]?.narration ?? '';
  return (text.match(/^[^.!?…]*[.!?…]?/)?.[0] ?? '').trim();
};
const kelime = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

const KONTROLLER = {
  kancaSoru: (j) => (ilkCumle(j).endsWith('?') ? null : 'ilk cümle soru işaretiyle biten bir soru olmalı'),
  kancaSoruDegil: (j) => (ilkCumle(j).endsWith('?') ? 'ilk cümle soru olmamalı (şaşırtıcı bilgi ya da iddia)' : null),
  baslikSoru: (j) => (/\?\s*\S{0,3}$/.test(j.title?.trim() ?? '') && !/\d/.test(j.title) ? null : 'başlık soru işaretiyle biten bir soru olmalı ve rakam içermemeli'),
  baslikRakam: (j) => (/\d/.test(j.title ?? '') && !/\?/.test(j.title) ? null : 'başlık soru olmamalı ve bir rakam içermeli'),
  kapak2: (j) => (kelime(j.thumbnailText) === 2 ? null : 'thumbnailText tam 2 kelime olmalı'),
  kapak34: (j) => ([3, 4].includes(kelime(j.thumbnailText)) ? null : 'thumbnailText 3 ya da 4 kelime olmalı'),
};

// Senaryo, slotun deney koluna uyuyor mu?
export function deneyHatalari(job, slotDeney) {
  if (!slotDeney) return [];
  if (job.deney?.id !== slotDeney.id || job.deney?.kol !== slotDeney.kol) {
    return [`bu video "${slotDeney.id}" deneyinin ${slotDeney.kol} kolu: "deney": {"id": "${slotDeney.id}", "kol": "${slotDeney.kol}"} yazılmalı`];
  }
  const kontrol = deneyBul(slotDeney.id)?.[slotDeney.kol]?.kontrol;
  const hata = kontrol ? KONTROLLER[kontrol](job) : null;
  return hata ? [`deney ${slotDeney.id}/${slotDeney.kol}: ${hata}`] : [];
}

const medyan = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

export function metrikDegeri(p, olcu) {
  if (olcu === 'kanca') return p.tip === 'short' ? p.kancaOran : p.tutma30;
  if (olcu === 'tiklanma') return p.tiklanma7;
  if (olcu === 'tutma') return p.tutma;
  return p.izlenme7;
}

// perfs: deneye giren videoların ölçüleri ({kol, sabit, ...}). Sonuç: A, B ya da belirsiz; ya da null (veri bekleniyor).
export function degerlendir(deneyKaydi, perfs, now = new Date()) {
  const d = deneyBul(deneyKaydi.id);
  const olgun = perfs.filter((p) => p.sabit);
  // Tıklanma oranı gelmiyorsa (Reporting izni yok) ilk hafta izlenmesine bakılır.
  const olcu = d.olcu === 'tiklanma' && olgun.some((p) => p.tiklanma7 == null) ? 'izlenme7' : d.olcu;
  const kol = (k) => olgun.filter((p) => p.kol === k).map((p) => metrikDegeri(p, olcu)).filter((v) => typeof v === 'number');
  const A = kol('A');
  const B = kol('B');
  const gun = (now.getTime() - Date.parse(deneyKaydi.baslangic)) / 86400000;
  const sureDoldu = gun >= SURE_SINIRI_GUN[deneyKaydi.tip ?? 'short'];
  if ((A.length < KOL_BASINA || B.length < KOL_BASINA) && !sureDoldu) return null;
  const mA = medyan(A);
  const mB = medyan(B);
  const sonuc = { olcu, A: { n: A.length, deger: mA }, B: { n: B.length, deger: mB }, fark: null, kazanan: 'belirsiz' };
  if (A.length < 2 || B.length < 2 || !mA) return sonuc;
  sonuc.fark = (mB - mA) / mA;
  const esik = FARK_ESIGI[olcu] ?? VARSAYILAN_ESIK;
  if (Math.abs(sonuc.fark) >= esik) sonuc.kazanan = sonuc.fark > 0 ? 'B' : 'A';
  return sonuc;
}
