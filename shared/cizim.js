// Lamba Altında çizim kiti: sahne çizimleri bu yardımcılarla yazılır (Claude Youtube/projeler/guncel-shorts/bagimsiz.js'ten).
// Her sahne çizimi 1000x700'lük bir alanda çizilir; Remotion bu alanı Shorts kartına ya da uzun videonun sağ sayfasına yerleştirir.
// Hem Remotion (tarayıcı) hem doğrulayıcı (Node) kullanır; bağımlılık yok.

export const ALAN = { w: 1000, h: 700 };
export const KAPAK_ALAN = { w: 300, h: 420 }; // uzun video kapağında yazının solundaki çizim

export const PALET = {
  kagit: '#F3EAD7', kg: '#E6DBC4', m: '#2B2A33', s: '#6B6252', gece: '#1E1C24', lamba: '#E8A33D', ak: '#9A5B12',
  bordo: '#7A2E24', pirinc: '#B8893B', mavi: '#1F2B57', yesil: '#5E7A4A',
};

// Gece zemininde mürekkep okunmaz: aynı çizim kâğıt renginde çizilir (kanca, kapak).
const GECE = { ...PALET, m: PALET.kagit, s: 'rgba(243,234,215,.7)', mavi: '#C9D3EA', ak: PALET.lamba };

export const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
export const pr = (u, a, b) => cl((u - a) / (b - a));
export const h = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

const KIT_ADLARI = ['K', 'ctx', 'T', 'u', 'W', 'H', 'MX', 'MY', 'h', 'cl', 'eo', 'pr', 'ink', 'ell', 'ln', 'kutu', 'txt', 'etk', 'ok', 'cizgiEtiket'];

// ctx: 2B çizim bağlamı (alanın sol üstü 0,0). T: videonun saniyesi (titreme için), font: yazı tipi ailesi.
export function kit(ctx, T, { font = 'Lora, serif', gece = false, alan = ALAN } = {}) {
  const K = gece ? GECE : PALET;
  const wob = (i, a = 1.3) => (h(i * 13.7 + Math.floor(T * 6) * 7.3) - 0.5) * 2 * a;
  function ink(p, { close = false, fill = null, w = 4, c = K.m, seed = 0, pp = 1, amp = 1.3, dash = null } = {}) {
    if (!Array.isArray(p) || p.length < 2 || pp <= 0) return;
    const n = Math.max(2, Math.ceil(p.length * cl(pp)));
    ctx.beginPath();
    for (let i = 0; i < n && i < p.length; i++) {
      const x = p[i][0] + wob(i + seed, amp), y = p[i][1] + wob(i + seed + 77, amp);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    if (close && pp >= 1) ctx.closePath();
    if (fill && pp >= 1) { ctx.fillStyle = fill; ctx.fill(); }
    if (w > 0) {
      ctx.setLineDash(dash || []); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  const ell = (cx, cy, rx, ry, n = 40, a0 = 0, a1 = Math.PI * 2) => {
    const q = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; q.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return q;
  };
  const ln = (a, b, n = 10) => {
    const q = [];
    for (let i = 0; i <= n; i++) q.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
    return q;
  };
  const kutu = (x, y, w, hh) => [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  function txt(s, x, y, size, { c = K.m, a = 1, al = 'center', w = 700, it = false } = {}) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = c;
    ctx.font = `${it ? 'italic ' : ''}${w} ${size}px ${font}`; ctx.textAlign = al; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(s), x, y); ctx.restore();
  }
  const etk = (s, x, y, a = 1, o = {}) => txt(s, x, y, o.size || 38, { c: o.c || K.mavi, a, al: o.al || 'center', w: 500, it: true });
  // Ok: a'dan b'ye mürekkep çizgisi ve uç.
  function ok(a, b, { c = K.m, w = 4, pp = 1, seed = 0 } = {}) {
    ink(ln(a, b, 12), { c, w, pp, seed });
    if (pp < 1) return;
    const an = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 18;
    ink([[b[0] - L * Math.cos(an - 0.45), b[1] - L * Math.sin(an - 0.45)], b, [b[0] - L * Math.cos(an + 0.45), b[1] - L * Math.sin(an + 0.45)]], { c, w, seed: seed + 5, amp: 0.5 });
  }
  // Nesneye kısa çizgiyle bağlanan italik etiket (eski videolardaki "açık ağız: soğutur" gibi).
  function cizgiEtiket(s, nokta, yazi, a = 1, o = {}) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    ink(ln(nokta, [yazi[0] - (o.al === 'right' ? -10 : 10), yazi[1] - 12], 6), { w: 2.4, c: o.c || K.mavi, seed: o.seed || 0 });
    ctx.restore();
    etk(s, yazi[0], yazi[1], a, { al: o.al || 'left', ...o });
  }
  return { K, ctx, T, W: alan.w, H: alan.h, MX: alan.w / 2, MY: alan.h / 2, h, cl, eo, pr, ink, ell, ln, kutu, txt, etk, ok, cizgiEtiket };
}

// Sahne çizim kodunu fonksiyona çevirir: (kit, u) => void. u: sahnenin başından beri geçen saniye.
// w('kelime'): o kelimenin söylendiği an (sahne saniyesi, u ile aynı saat); çizim sözle eşzamanlı olsun diye
// (kullanıcı kararı 2026-11-27). sozler: [{ text, u }]; bulunamayan kelime 0 döner (çizim hemen başlar).
const sadeK = (x) => String(x).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');
export function kelimeSaati(sozler = [], ek = 0) {
  return (kelime) => { const k = sadeK(kelime); const x = sozler.find((s) => sadeK(s.text).startsWith(k)); return x ? x.u + ek : 0; };
}
export function derle(kod, w = () => 0) {
  // eslint-disable-next-line no-new-func
  const f = new Function(...KIT_ADLARI, 'w', `"use strict";\n${kod}`);
  return (k, u) => f(...KIT_ADLARI.map((ad) => (ad === 'u' ? u : k[ad])), w);
}

// Doğrulayıcı için sahte çizim bağlamı: her metodu kabul eder, hiçbir şey çizmez.
export function sahteCtx() {
  const gradient = { addColorStop() {} };
  const target = {
    measureText: (s) => ({ width: String(s).length * 20 }),
    createRadialGradient: () => gradient, createLinearGradient: () => gradient,
    getImageData: () => ({ data: [] }),
  };
  return new Proxy(target, {
    get: (t, p) => (p in t ? t[p] : () => {}),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}

// Çizim kodunu birkaç anda çalıştırıp hatayı döner (yoksa null).
export function cizimHatasi(kod, sure = 6, secenek = {}) {
  if (typeof kod !== 'string' || !kod.trim()) return 'cizim boş';
  if (kod.length > 6000) return 'cizim 6000 karakteri geçmemeli';
  if (/\b(fetch|XMLHttpRequest|import|require|document|window|globalThis|eval|Function|setTimeout|setInterval|while)\b/.test(kod)) {
    return 'cizim içinde fetch/import/document/window/eval/while gibi ifadeler kullanılamaz';
  }
  if (/Math\.random|Date\.now|new Date/.test(kod)) return 'Math.random/Date kullanma; rastgelelik için h(n) kullan (kareler aynı kalmalı)';
  let f;
  try { f = derle(kod); } catch (e) { return `sözdizimi hatası: ${e.message}`; }
  try {
    for (const u of [0, 0.4, 1.2, sure / 2, sure]) f(kit(sahteCtx(), 3 + u, secenek), u);
  } catch (e) {
    return `çalışma hatası: ${e.message}`;
  }
  return null;
}
