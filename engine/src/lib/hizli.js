// Hızlı Shorts kuralı (2026-11-13, tüm kanallar): Shorts çok hızlı ve kısa olur.
//   - 4-5 cümle (son cümle abone/beğen çağrısı), yaklaşık 20-28 saniye
//   - başlık ve ekrandaki dev yazı bir SORUN ya da soru bildirir, video ÇÖZÜMÜ/cevabı verir
//   - seslendirme hızlandırılır (motor: Shorts'ta en az +30%, uzun videoda en az +20%)
// Uzun videolarda da abone/beğen çağrısı zorunludur.
// Bağımlılıksızdır: planlayıcı ve doğrulayıcı bulut rutininde npm install olmadan çalışır.

export const HIZLI_SN = 24;
export const HIZLI_TEMPO = 1.3; // Shorts'ta en az bu konuşma hızı (kullanıcı 2026-11-20: daha hızlı)
export const UZUN_TEMPO = 1.2; // uzun videoda en az bu konuşma hızı (kullanıcı kararı 2026-11-16 ve 2026-11-20: her video hızlı)
// Videonun türüne göre en düşük konuşma hızı (kanal daha hızlısını seçtiyse o geçerli)
export const enAzTempo = (tip) => (tip === 'short' ? HIZLI_TEMPO : UZUN_TEMPO);
export const HIZLI_CUMLE = { min: 4, max: 6 }; // 4-5 cümle; oylama sorusu ayrı cümleyse 6'ya kadar
export const HIZLI_DIZI_HIZ = { min: 1.15, max: 1.4 };

// Shorts'un hedef kelime sayısı: dilin dakikadaki kelime hızı × hızlandırma × süre (tr 55, en 72, de 60).
export const hizliKelime = (wpm) => Math.round((HIZLI_SN / 60) * wpm * HIZLI_TEMPO);

// Cümle sayısı: nokta, soru, ünlem ya da üç noktayla biten parçalar (ondalık "2,5" ve "1.000" sayılmaz).
export function cumleSay(metin) {
  return String(metin ?? '')
    .replace(/(\d)[.,](\d)/g, '$1$2')
    .replace(/(\d)\.(\s+\p{Ll})/gu, '$1$2') // sıra sayısı: "3. sırada"
    .split(/[.!?…]+(?:\s+|$)/)
    .filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
}

// Abone ol / beğen çağrısı (kanal dilinde). Türkçe ekleri de yakalar: "abone olun", "beğenmeyi unutma".
const CAGRI = {
  tr: [/abone/i, /beğen/i],
  en: [/subscri/i, /\blike\b|\bfollow/i],
  de: [/abonnier|abo\b/i, /like|daumen|gefällt/i],
  es: [/suscr[ií]b/i, /me gusta|\blike\b/i],
  fr: [/abonne/i, /like|j'aime|pouce/i],
  pt: [/inscrev/i, /curt|like/i],
};

// Metinde hem abone hem beğen çağrısı var mı? Dil tanınmıyorsa kontrol edilmez.
export function cagriEksigi(metin, dil = 'tr') {
  const [abone, begen] = CAGRI[dil] ?? [];
  if (!abone) return null;
  const t = String(metin ?? '');
  if (!abone.test(t)) return 'abone ol çağrısı yok';
  if (!begen.test(t)) return 'beğen çağrısı yok';
  return null;
}

// Senaryonun seslendirilen metni, sırayla (format bağımsız).
export function anlatimMetinleri(job) {
  if (job?.format === 'duell') return ['intro', 'nodata', 'rounds', 'final', 'winner', 'why', 'table'].map((p) => job.duell?.script?.[p] ?? '');
  if (job?.format === 'dizi') return (job.scenes ?? []).flatMap((s) => (s.satirlar ?? []).map((x) => x?.metin ?? ''));
  return (job?.scenes ?? []).map((s) => s?.narration ?? '');
}
