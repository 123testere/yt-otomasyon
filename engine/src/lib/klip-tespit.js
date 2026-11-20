// Yayın kesiti tespiti (Vice City Dispatch): uzun yayın videosunda "patlayan" anları bulur.
// Algoritma nirvagold/stream-clipper'dan (MIT) uyarlandı: ses yüksekliği sıçraması + sohbet patlaması,
// birlikte olursa kombo bonusu, çakışanlar birleştirilir, başa/sona pay eklenir.
// Bizim eklediklerimiz: YouTube "en çok tekrar izlenen" ısı haritası ve yorumlardaki zaman damgaları.
// Bağımlılıksızdır (saf fonksiyonlar); indirme ve ses çözme klip-bul.js'tedir.

export const KLIP_AYAR = {
  hassasiyet: 2, // 1 çok kesit … 4 az kesit (stream-clipper: 75/82/90/95. yüzdelik)
  agirlik: { ses: 0.4, sohbet: 0.35, harita: 0.45, yorum: 0.3 },
  kombo: [1, 1.5, 1.8, 2], // aynı anda kaç farklı sinyal → çarpan
  tolerans: 3, // sn: bu kadar yakın sinyaller aynı an sayılır
  minSn: 12,
  maxSn: 45,
  onPay: 4, // olaydan önce bağlam
  arkaPay: 3, // tepkiden sonra
};

// Sohbette heyecan kelimeleri (İngilizce yayınlar; Türkçe de yakalanır)
const HEYECAN = /\b(lol+|lmao+|omg+|wtf|w+|pog+|poggers|clip+ ?(it|that)?|no ?way|holy|bro+|insane|kekw|lul|💀|😂|🤣|😭|🔥)\b|💀|😂|🤣|😭|🔥|!!!|\?\?\?/iu;

const medyan = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const yuzdelik = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const yuzdelikEsik = (h) => (h <= 1 ? 75 : h <= 2 ? 82 : h <= 3 ? 90 : 95);

// Eşiği aşan ardışık parçaları aralık yapar; aradaki kısa boşlukları (bosluk sn) kapatır.
function araliklar(degerler, esik, adim, bosluk, puanla) {
  const out = [];
  let cur = null;
  degerler.forEach((v, i) => {
    if (v > esik) {
      if (cur && i * adim - cur.son <= bosluk) { cur.son = (i + 1) * adim; cur.tepe = Math.max(cur.tepe, v); }
      else { if (cur) out.push(cur); cur = { bas: i * adim, son: (i + 1) * adim, tepe: v }; }
    }
  });
  if (cur) out.push(cur);
  return out.map((a) => ({ bas: a.bas, son: a.son, puan: Math.min(100, Math.max(0, puanla(a.tepe))) }));
}

// Ses: saniyelik RMS dizisi → yükseklik sıçramaları (bağırma, gülme, tepki)
export function sesSicramalari(rms, ayar = KLIP_AYAR, adim = 1) {
  if (!rms?.length) return [];
  const taban = medyan(rms) || 1e-6;
  let esik = yuzdelik(rms, yuzdelikEsik(ayar.hassasiyet));
  if (esik <= taban * 1.15) esik = taban * (1 + ayar.hassasiyet * 0.35);
  return araliklar(rms, esik, adim, 2, (tepe) => (tepe / taban - 1) * 100).map((s) => ({ ...s, tur: 'ses' }));
}

// Sohbet: [{t (sn), metin}] → 5 sn pencerede mesaj yoğunluğu; heyecan kelimesi 3 mesaj sayılır
export function sohbetSicramalari(mesajlar, ayar = KLIP_AYAR, pencere = 5) {
  if (!mesajlar?.length) return [];
  const son = Math.max(...mesajlar.map((m) => m.t));
  const kova = new Array(Math.floor(son / pencere) + 1).fill(0);
  for (const m of mesajlar) kova[Math.floor(m.t / pencere)] += HEYECAN.test(m.metin ?? '') ? 3 : 1;
  const taban = medyan(kova) || 1;
  const esik = Math.max(taban * 2, yuzdelik(kova, yuzdelikEsik(ayar.hassasiyet) + 4));
  return araliklar(kova, esik, pencere, pencere, (tepe) => (tepe / taban - 1) * 25).map((s) => ({ ...s, tur: 'sohbet' }));
}

// Isı haritası (yt-dlp "heatmap": [{start_time, end_time, value 0-1}]) → en çok tekrar izlenen bölümler
export function haritaSicramalari(harita, ayar = KLIP_AYAR) {
  if (!harita?.length) return [];
  const v = harita.map((h) => h.value);
  const esik = Math.max(0.5, yuzdelik(v, yuzdelikEsik(ayar.hassasiyet) + 5));
  return harita
    .filter((h) => h.value >= esik)
    .reduce((acc, h) => {
      const sonu = acc.at(-1);
      if (sonu && h.start_time - sonu.son <= 1) { sonu.son = h.end_time; sonu.puan = Math.max(sonu.puan, h.value * 100); }
      else acc.push({ bas: h.start_time, son: h.end_time, puan: h.value * 100, tur: 'harita' });
      return acc;
    }, []);
}

// Yorumlardaki zaman damgası: "1:02:33", "12:34" → o anın ±8 sn'si; beğeni ve tekrar sayısı puanı artırır
const DAMGA = /(?<![\d:])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?![\d:])/g;
export function zamanDamgalari(metin) {
  const out = [];
  for (const m of String(metin ?? '').matchAll(DAMGA)) {
    const [s, dk, sn] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
    if (sn < 60 && (m[1] == null || dk < 60)) out.push(s * 3600 + dk * 60 + sn);
  }
  return out;
}
export function yorumSicramalari(yorumlar, sure = Infinity) {
  const anlar = new Map(); // 10 sn kovası → ağırlık
  for (const y of yorumlar ?? []) {
    for (const t of zamanDamgalari(y.metin)) {
      if (t > sure) continue;
      const k = Math.floor(t / 10);
      anlar.set(k, (anlar.get(k) ?? 0) + 1 + Math.log10(1 + (y.begeni ?? 0)));
    }
  }
  return [...anlar.entries()].map(([k, w]) => ({ bas: Math.max(0, k * 10 - 8), son: k * 10 + 18, puan: Math.min(100, 30 + w * 20), tur: 'yorum' }));
}

// Bütün sinyalleri birleştirir: yakın/çakışan aralıklar tek an olur; her türün en yüksek puanı ağırlıkla toplanır,
// farklı tür sayısına göre kombo çarpanı uygulanır (stream-clipper: ses+sohbet ×1,5).
export function puanla(sinyaller, ayar = KLIP_AYAR) {
  const sirali = [...sinyaller].sort((a, b) => a.bas - b.bas);
  const kumeler = [];
  for (const s of sirali) {
    const k = kumeler.at(-1);
    if (k && s.bas <= k.son + ayar.tolerans) { k.son = Math.max(k.son, s.son); k.parca.push(s); }
    else kumeler.push({ bas: s.bas, son: s.son, parca: [s] });
  }
  return kumeler
    .map((k) => {
      const enIyi = {};
      for (const p of k.parca) enIyi[p.tur] = Math.max(enIyi[p.tur] ?? 0, p.puan);
      const turler = Object.keys(enIyi);
      const toplam = turler.reduce((a, t) => a + enIyi[t] * (ayar.agirlik[t] ?? 0.3), 0);
      const carpan = ayar.kombo[Math.min(turler.length, ayar.kombo.length) - 1];
      return { bas: k.bas, son: k.son, puan: Math.round(Math.min(100, toplam * carpan) * 10) / 10, sinyaller: enIyi };
    })
    .sort((a, b) => b.puan - a.puan);
}

// Ana an → yüklenecek kesit aralığı: başa bağlam, sona tepki payı; Shorts için min/max süreye oturtulur
export function kesitAraligi(an, sure, ayar = KLIP_AYAR) {
  let bas = Math.max(0, an.bas - ayar.onPay);
  let son = Math.min(sure, an.son + ayar.arkaPay);
  if (son - bas > ayar.maxSn) {
    // uzun anlarda en güçlü kısmı ortada tut
    const orta = (an.bas + an.son) / 2;
    bas = Math.max(0, orta - ayar.maxSn / 2);
    son = Math.min(sure, bas + ayar.maxSn);
  }
  if (son - bas < ayar.minSn) {
    const eksik = ayar.minSn - (son - bas);
    bas = Math.max(0, bas - eksik / 2);
    son = Math.min(sure, bas + ayar.minSn);
  }
  return { bas: Math.round(bas * 10) / 10, son: Math.round(son * 10) / 10 };
}

// Hepsi bir arada: en iyi N kesit (birbirine en az 60 sn uzak, aynı anı iki kez vermez)
export function enIyiKesitler({ rms, mesajlar, harita, yorumlar, sure }, adet = 3, ayar = KLIP_AYAR) {
  const sinyaller = [
    ...sesSicramalari(rms, ayar),
    ...sohbetSicramalari(mesajlar, ayar),
    ...haritaSicramalari(harita, ayar),
    ...yorumSicramalari(yorumlar, sure),
  ];
  const secilen = [];
  for (const an of puanla(sinyaller, ayar)) {
    if (an.bas < 20) continue; // yayın açılışı (selamlaşma) kesit olmaz
    if (secilen.some((s) => Math.abs(s.bas - an.bas) < 60)) continue;
    secilen.push({ ...an, kesit: kesitAraligi(an, sure ?? an.son + 60, ayar) });
    if (secilen.length >= adet) break;
  }
  return secilen;
}
