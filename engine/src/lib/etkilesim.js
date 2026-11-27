// Etkileşim kuralı (kullanıcı kararı 2026-11-27, bütün kanallar; yeni senaryolarda zorunlu):
//  1) Video soru ve merakla başlar: ilk sahnede '?' olan bir cümle + "soru" alanı (iki seçenek, cevabı sonda).
//  2) Doğru cevap videonun ikinci yarısında söylenir.
//  3) Son cümle kaçırmamak için abone olma / takip etme çağrısıdır (ekrandaki kısa çağrılar motordan gelir).
//  4) Çizim formatında anlatılan, söylendiği anda çizilir: sahne çizimi w('kelime') ile söze bağlanır.
const ABONE = { tr: /abone|takip/i, en: /subscribe|follow/i, de: /abonn|folg/i };
const kelimeler = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const sade = (x) => String(x).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ');

// Sahne metinleri (format fark etmeksizin): cizim/belgesel → narration, dizi → satirlar[].metin
export const sahneMetinleri = (job) => (job.scenes ?? []).map((s) => (Array.isArray(s.satirlar) ? s.satirlar.map((x) => x?.metin ?? '').join(' ') : s.narration ?? ''));

export function etkilesimHatalari(job, dil = 'tr') {
  if (job.derleme || job.format === 'kesit' || job.format === 'duell' || !Array.isArray(job.scenes) || !job.scenes.length) return [];
  const e = [];
  const s = job.soru;
  const str = (v, n) => typeof v === 'string' && v.trim().length > 0 && v.length <= n;
  if (!(s && str(s.metin, 60) && str(s.a, 24) && str(s.b, 24) && ['a', 'b'].includes(s.dogru))) {
    e.push('soru {metin ≤60, a ≤24, b ≤24, dogru: "a"|"b"} yaz: video iki seçenekli bir soruyla başlar, cevabı sonda (ekranda kart olarak çıkar)');
    return e;
  }
  const metin = sahneMetinleri(job);
  if (!/\?/.test(metin[0])) e.push('ilk sahnede izleyiciye soru sor ("Sence neden…?") ve merak uyandır; cevabı sonda vereceğini söyle');
  // Doğru seçenek ikinci yarıda söylenmeli
  const dogru = sade(s.dogru === 'b' ? s.b : s.a).split(/\s+/).filter((k) => k.length > 2);
  const yari = Math.floor(metin.length / 2);
  const ikinci = sade(metin.slice(yari).join(' '));
  if (dogru.length && !dogru.some((k) => ikinci.includes(k.slice(0, Math.max(4, k.length - 2))))) e.push(`doğru cevabı ("${s.dogru === 'b' ? s.b : s.a}") videonun ikinci yarısında söyle ("Doğru cevap: …")`);
  // Son cümle: kaçırmamak için abone ol / takip et
  const son = metin.at(-1) ?? '';
  if (!(ABONE[dil] ?? ABONE.tr).test(son)) e.push('son cümlede kaçırmamak için abone olup takip etmelerini söyle (ör. "Yeni hikâyeleri kaçırmamak için abone olun, takip edin.")');
  // Çizim: anlatılan söylendiği anda çizilir
  if (job.format === 'cizim') {
    job.scenes.forEach((sc, i) => {
      if (sc.cizim && kelimeler(sc.narration) >= 8 && !/\bw\(\s*['"`]/.test(sc.cizim)) e.push(`sahne ${i + 1}: çizimi söze bağla: anlatılan nesne/olay w('kelime') anında çizilsin (ör. pr(u, w('çatladı'), w('çatladı') + .5))`);
    });
  }
  return e;
}
