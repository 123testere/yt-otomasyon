// Etkileşim katmanı (kullanıcı kararı 2026-11-27, bütün kanallar): videonun başında, ortasında ve sonunda kısa
// "Beğen · Abone ol" çağrısı; başta iki seçenekli soru, cevabı sonda. Bağımlılıksız Canvas 2D; bütün çizim motorları kullanır.
// Shorts'ta YouTube düğmeleri sağ alt ve altı kapatır: çağrı sağ üstte, soru üstte durur.

const METIN = {
  tr: { cagri: ['👍 Beğen', '🔔 Abone ol'], cevapSonda: 'Cevap sonda · tahminini yorumlara yaz' },
  en: { cagri: ['👍 Like', '🔔 Subscribe'], cevapSonda: 'Answer at the end · comment your guess' },
  de: { cagri: ['👍 Liken', '🔔 Abonnieren'], cevapSonda: 'Antwort am Ende · tippe in die Kommentare' },
};
export const ctaMetin = (dil) => METIN[dil] ?? METIN.tr;
const cl = (v) => Math.min(1, Math.max(0, v));
const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
const pr = (t, a, b) => cl((t - a) / (b - a));
export const sade = (x) => String(x).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');

// Üç çağrı anı (sn): baş (kancadan sonra), orta, son. Kısa videoda baştaki 4 sn'de, uzun videoda 20 sn'de.
export function ctaAnlari(d, uzun = false) {
  return [Math.min(uzun ? 20 : 4, d * 0.15), d * 0.5, Math.max(0, d - 3.4)];
}

// Çağrı hapı: kısa süre (2,6 sn) zıplayarak belirir, söner. x,y: hapın merkezi; s: ölçek
export function ctaCiz(ctx, { t, d, dil = 'tr', x, y, s = 1, uzun = false, font = 'sans-serif', renk = '#C0392B' }) {
  const [begen, abone] = ctaMetin(dil).cagri;
  ctaAnlari(d, uzun).forEach((t0, i) => {
    const a = eo(pr(t, t0, t0 + 0.3)) * (1 - pr(t, t0 + 2.3, t0 + 2.6));
    if (a <= 0) return;
    const zip = (1 + 0.18 * (1 - eo(pr(t, t0, t0 + 0.35))) + 0.03 * Math.sin(t * 9)) * s;
    const yazi = `${begen}  ·  ${abone}`;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(zip, zip);
    ctx.font = `800 44px ${font}`;
    const w = ctx.measureText(yazi).width + 70;
    ctx.fillStyle = renk; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.roundRect(-w / 2, -44, w, 88, 44); ctx.fill(); ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(yazi, 0, 3);
    // son çağrıda küçük ok: "aşağıda/yanda düğme" hissi
    if (i === 2) { ctx.font = `800 40px ${font}`; ctx.fillText('👇', w / 2 + 34, 6 + Math.sin(t * 8) * 5); }
    ctx.restore();
  });
}

// Soru anları: soru "soru.kelime" (yoksa ilk '?' içeren kelime) söylenince başlar; cevap "soru.cevapKelime" ya da
// doğru seçeneğin ikinci yarıda ilk geçtiği yerde yanar. words: [{t, text}] (videonun saniyesi)
export function soruZamanlari(soru, words = [], d = 0) {
  const bul = (k, sonra = 0) => words.find((w) => w.t >= sonra && sade(w.text).startsWith(sade(k)))?.t;
  const ilkSoru = words.find((w) => /\?/.test(w.text))?.t;
  const bas = (soru.kelime && bul(soru.kelime)) ?? (ilkSoru !== undefined ? Math.max(0, ilkSoru - 1.2) : 2);
  const dogruMetin = soru.dogru === 'b' ? soru.b : soru.a;
  const cevap = (soru.cevapKelime && bul(soru.cevapKelime, d / 2)) ?? bul(String(dogruMetin).split(/\s+/)[0], d / 2) ?? Math.max(bas + 1, d - 6);
  return { bas, cevap };
}

// İki seçenekli soru kartı. x,y: kartın üst ortası; gen: genişlik. Cevap anında doğru seçenek yeşil, diğeri sönük.
export function soruCiz(ctx, { soru, t, words, d, dil = 'tr', x, y, gen = 1000, font = 'sans-serif', kagit = '#F3EAD7', vurgu = '#E8A33D', zemin = 'rgba(20,18,26,.78)' }) {
  if (!soru?.metin) return 0;
  const { bas, cevap } = soruZamanlari(soru, words, d);
  const a = eo(pr(t, bas, bas + 0.4));
  if (a <= 0) return 0;
  const cv = eo(pr(t, cevap, cevap + 0.5));
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = zemin; ctx.beginPath(); ctx.roundRect(x - gen / 2, y, gen, 250, 26); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (t < cevap) { ctx.font = `700 30px ${font}`; ctx.fillStyle = vurgu; ctx.fillText(ctaMetin(dil).cevapSonda, x, y + 42); }
  let mb = 58; ctx.font = `800 ${mb}px ${font}`;
  while (ctx.measureText(soru.metin).width > gen - 50 && mb > 30) { mb -= 3; ctx.font = `800 ${mb}px ${font}`; }
  ctx.fillStyle = kagit; ctx.fillText(soru.metin, x, y + 104);
  const kw = (gen - 60) / 2;
  [['A', soru.a, x - kw / 2 - 10], ['B', soru.b, x + kw / 2 + 10]].forEach(([harf, m, cx], j) => {
    const b = eo(pr(t, bas + 0.3 + j * 0.25, bas + 0.8 + j * 0.25));
    const dogru = (soru.dogru === 'b') === (j === 1);
    const sonuk = cv > 0 && !dogru;
    ctx.save(); ctx.globalAlpha = a * b * (sonuk ? 0.4 : 1);
    ctx.lineWidth = 5; ctx.strokeStyle = cv > 0 && dogru ? '#5E9A4A' : vurgu; ctx.fillStyle = cv > 0 && dogru ? 'rgba(94,154,74,.3)' : 'rgba(232,163,61,.12)';
    ctx.beginPath(); ctx.roundRect(cx - kw / 2, y + 128, kw, 100, 22); ctx.fill(); ctx.stroke();
    const yazi = `${harf}) ${m}${cv > 0 && dogru ? '  ✓' : ''}`;
    let boy = 48; ctx.font = `800 ${boy}px ${font}`;
    while (ctx.measureText(yazi).width > kw - 30 && boy > 28) { boy -= 3; ctx.font = `800 ${boy}px ${font}`; }
    ctx.fillStyle = kagit; ctx.textAlign = 'center'; ctx.fillText(yazi, cx, y + 194);
    ctx.restore();
  });
  ctx.restore();
  return a;
}
