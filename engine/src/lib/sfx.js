// Efekt sesleri: dışarıdan indirilmez, kodla sentezlenir (ücretsiz, lisanssız, her seferinde aynı).
// Kılıç çarpması, savurma, adımlar (taş/kum/su), düşme, kapı gıcırtısı, kapak, taş geçit, zincir, kilit, anahtar,
// yere düşen kılıç ve mekân ortam sesleri (akan su, damla, meşale, kalabalık, rüzgâr).
// sfxHazirla(dir): eksik WAV'ları üretir (44,1 kHz mono 16 bit). Render öncesi çağrılır.
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;

// Tohumlu rastgele (her üretim aynı sesi verir)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function wavYaz(file, f32) {
  let tepe = 0;
  for (const v of f32) tepe = Math.max(tepe, Math.abs(v));
  const k = tepe > 0 ? 0.89 / tepe : 1;
  const b = Buffer.alloc(44 + f32.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + f32.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(f32.length * 2, 40);
  for (let i = 0; i < f32.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i] * k)) * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}

const tampon = (sn) => new Float32Array(Math.round(sn * SR));

// Basit filtreler
function alcakGecir(x, kesim) {
  const a = 1 - Math.exp((-2 * Math.PI * kesim) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; }
  return x;
}
function yuksekGecir(x, kesim) {
  const a = Math.exp((-2 * Math.PI * kesim) / SR);
  let onceX = 0; let y = 0;
  for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - onceX); onceX = x[i]; x[i] = y; }
  return x;
}
// Rezonanslı bant geçiren (durum değişkenli filtre); kesim zamanla değişebilir: f(i) → Hz
function bantGecir(x, f, q = 4) {
  let low = 0; let band = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof f === 'function' ? f(i) : f;
    const F = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    low += F * band;
    const high = x[i] - low - band / q;
    band += F * high;
    x[i] = band;
  }
  return x;
}
const gurultu = (n, r) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; };
function ekle(hedef, kaynak, bas = 0, kazanc = 1) {
  const o = Math.round(bas * SR);
  for (let i = 0; i < kaynak.length && o + i < hedef.length; i++) if (o + i >= 0) hedef[o + i] += kaynak[i] * kazanc;
  return hedef;
}

// Metal çınlama: uyumsuz kısmi tonlar, her biri kendi hızıyla söner
function metal(sn, frekanslar, r, { sonum = 0.35, parlak = 1 } = {}) {
  const x = tampon(sn);
  frekanslar.forEach((f, k) => {
    const d = sonum * (1 - k * 0.12) * (0.8 + r() * 0.4);
    const a = (1 / (k + 1)) ** (1 / parlak);
    const ph = r() * 6.28;
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += a * Math.sin(2 * Math.PI * f * t + ph) * Math.exp(-t / d); }
  });
  return x;
}
// Darbe başlangıcı: çok kısa gürültü patlaması
function vurus(sn, r, kesim = 3000, sure = 0.015) {
  const x = gurultu(Math.round(sn * SR), r);
  for (let i = 0; i < x.length; i++) x[i] *= Math.exp(-i / SR / sure);
  return yuksekGecir(x, kesim);
}
// Tok vuruş: alçak frekanslı, perdesi düşen sinüs
function tok(sn, f0, f1, sonum, r) {
  const x = tampon(sn); let ph = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; const f = f1 + (f0 - f1) * Math.exp(-t / 0.03); ph += (2 * Math.PI * f) / SR; x[i] = Math.sin(ph) * Math.exp(-t / sonum); }
  const g = gurultu(x.length, r); alcakGecir(g, 900);
  for (let i = 0; i < x.length; i++) x[i] += g[i] * 0.5 * Math.exp(-i / SR / (sonum * 0.5));
  return x;
}
// Uçlarda yumuşak giriş/çıkış ve döngüde dikiş yeri duyulmasın diye çapraz geçiş
function dongu(x, gecis = 0.5) {
  const n = Math.round(gecis * SR); const out = x.slice(0, x.length - n);
  for (let i = 0; i < n; i++) { const k = i / n; out[i] = x[i] * k + x[x.length - n + i] * (1 - k); }
  return out;
}

const SESLER = {
  'kilic-carpma': (r) => { const x = metal(1.1, [1190, 1745, 2630, 3480, 4420, 5310], r, { sonum: 0.32 }); return ekle(x, vurus(0.05, r, 2500), 0, 2.5); },
  'kilic-carpma2': (r) => { const x = metal(1.1, [1330, 1960, 2810, 3720, 4630], r, { sonum: 0.28 }); return ekle(x, vurus(0.05, r, 2500), 0, 2.5); },
  'kilic-carpma3': (r) => { const x = metal(1.1, [1080, 1620, 2470, 3290, 4170, 5020], r, { sonum: 0.36 }); return ekle(x, vurus(0.05, r, 2500), 0, 2.5); },
  'kilic-savurma': (r) => {
    const sn = 0.38; const x = gurultu(Math.round(sn * SR), r); const n = x.length;
    bantGecir(x, (i) => 500 + Math.sin((i / n) * Math.PI) * 2600, 3);
    for (let i = 0; i < n; i++) x[i] *= Math.sin((i / n) * Math.PI) ** 1.5;
    return x;
  },
  'adim-tas': (r) => ekle(tok(0.16, 140, 70, 0.035, r), vurus(0.03, r, 1800, 0.006), 0, 0.6),
  'adim-tas2': (r) => ekle(tok(0.16, 125, 62, 0.04, r), vurus(0.03, r, 1600, 0.006), 0, 0.5),
  'adim-kum': (r) => { const x = gurultu(Math.round(0.18 * SR), r); alcakGecir(x, 1400); for (let i = 0; i < x.length; i++) x[i] *= Math.exp(-i / SR / 0.05); return ekle(x, tok(0.18, 90, 55, 0.03, r), 0, 0.5); },
  'adim-su': (r) => {
    const x = gurultu(Math.round(0.3 * SR), r); bantGecir(x, 1600, 2);
    for (let i = 0; i < x.length; i++) x[i] *= Math.exp(-i / SR / 0.07);
    for (let k = 0; k < 4; k++) { const b = tampon(0.06); const f = 500 + r() * 700; for (let i = 0; i < b.length; i++) b[i] = Math.sin(2 * Math.PI * f * (1 + i / b.length) * i / SR) * Math.exp(-i / SR / 0.02); ekle(x, b, 0.03 + r() * 0.15, 0.3); }
    return ekle(x, tok(0.3, 100, 60, 0.04, r), 0, 0.4);
  },
  'dusme': (r) => {
    const x = tok(0.9, 110, 45, 0.18, r);
    const g = gurultu(x.length, r); alcakGecir(g, 600);
    for (let i = 0; i < x.length; i++) x[i] += g[i] * 0.35 * Math.exp(-i / SR / 0.25);
    return ekle(x, tok(0.4, 90, 50, 0.08, r), 0.16, 0.5);
  },
  'gum': (r) => tok(0.7, 90, 40, 0.16, r),
  'kilic-yere': (r) => {
    const x = tampon(1.0);
    [[0, 1], [0.13, 0.55], [0.24, 0.3], [0.3, 0.15]].forEach(([t, a]) => ekle(x, ekle(metal(0.6, [1520, 2310, 3390, 4480], r, { sonum: 0.12 }), vurus(0.03, r), 0, 2), t, a));
    return x;
  },
  'anahtar': (r) => {
    const x = tampon(0.8);
    for (let k = 0; k < 9; k++) ekle(x, metal(0.3, [3200 + r() * 1800, 5100 + r() * 1500], r, { sonum: 0.06 }), r() * 0.45, 0.35 + r() * 0.4);
    return x;
  },
  'zincir': (r) => {
    const x = tampon(0.75);
    for (let k = 0; k < 11; k++) ekle(x, ekle(metal(0.12, [2600 + r() * 1400, 4300 + r() * 1200], r, { sonum: 0.025 }), vurus(0.01, r, 3000, 0.003), 0, 1), r() * 0.55, 0.3 + r() * 0.5);
    return x;
  },
  'kilit': (r) => {
    const x = tampon(0.45);
    ekle(x, vurus(0.04, r, 2500, 0.004), 0, 1); ekle(x, vurus(0.04, r, 2000, 0.004), 0.07, 0.8);
    return ekle(x, metal(0.35, [1900, 2870, 4100], r, { sonum: 0.08 }), 0.07, 0.4);
  },
  'kapi-gicirti': (r) => {
    // Menteşe gıcırtısı: sürtünmeyle kesik kesik titreşen ton, perdesi dalgalanır; sonunda ağır kanadın tok sesi
    const sn = 2.2; const x = tampon(sn); let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR; const f = 170 + 90 * Math.sin(t * 2.3) + 60 * Math.sin(t * 7.1 + 1);
      ph += (2 * Math.PI * f) / SR; const testere = ((ph / (2 * Math.PI)) % 1) * 2 - 1;
      const kesik = Math.max(0, Math.sin(t * 31 + Math.sin(t * 5) * 3)) ** 3;
      x[i] = testere * kesik * Math.min(1, t * 4) * Math.min(1, (sn - t) * 2);
    }
    bantGecir(x, 950, 6);
    const tahta = gurultu(x.length, r); alcakGecir(tahta, 500);
    for (let i = 0; i < x.length; i++) x[i] += tahta[i] * 0.15;
    return ekle(x, tok(0.5, 80, 45, 0.12, r), 1.75, 0.6);
  },
  'kapak': (r) => {
    // Ahşap kapağın taş üstünde sürtünmesi, sonra dikilip yaslanması
    const sn = 2.0; const x = gurultu(Math.round(sn * SR), r); bantGecir(x, (i) => 300 + Math.sin(i / SR * 9) * 120, 2);
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.min(1, t * 3) * Math.max(0, 1 - t / 1.6) * (0.6 + 0.4 * Math.sin(t * 23)); }
    ekle(x, tok(0.5, 95, 50, 0.1, r), 1.55, 0.8);
    return x;
  },
  'tas-surtme': (r) => {
    const sn = 2.0; const x = gurultu(Math.round(sn * SR), r); alcakGecir(x, 380);
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.min(1, t * 2.5) * Math.max(0, 1 - t / 1.9) * (0.7 + 0.3 * Math.sin(t * 40 + Math.sin(t * 7) * 4)); }
    return ekle(x, tok(0.6, 70, 35, 0.15, r), 1.6, 0.7);
  },
  // --- Ortam sesleri (döngü) ---
  'ortam-su': (r) => {
    const sn = 6.5; const x = gurultu(Math.round(sn * SR), r);
    let y = 0; for (let i = 0; i < x.length; i++) { y = 0.985 * y + 0.04 * x[i]; x[i] = y; }
    bantGecir(x, 700, 1.2);
    for (let k = 0; k < 40; k++) { const b = tampon(0.05); const f = 400 + r() * 900; for (let i = 0; i < b.length; i++) b[i] = Math.sin(2 * Math.PI * f * (1 + 0.8 * i / b.length) * i / SR) * Math.exp(-i / SR / 0.015); ekle(x, b, r() * (sn - 0.1), 0.06); }
    return dongu(x);
  },
  'ortam-damla': (r) => {
    const sn = 6.5; const x = gurultu(Math.round(sn * SR), r); alcakGecir(x, 200);
    for (let i = 0; i < x.length; i++) x[i] *= 0.05;
    for (let t = 0.4; t < sn - 0.6; t += 0.9 + r() * 1.2) {
      const b = tampon(0.35); const f = 900 + r() * 700;
      for (let i = 0; i < b.length; i++) { const tt = i / SR; b[i] = Math.sin(2 * Math.PI * f * (1 - tt * 1.2) * tt) * Math.exp(-tt / 0.05); }
      ekle(x, b, t, 0.5 + r() * 0.4);
    }
    return dongu(x);
  },
  'ortam-ates': (r) => {
    const sn = 6.5; const x = gurultu(Math.round(sn * SR), r); alcakGecir(x, 500);
    for (let i = 0; i < x.length; i++) x[i] *= 0.25;
    for (let k = 0; k < 160; k++) ekle(x, vurus(0.02, r, 1500 + r() * 2500, 0.002 + r() * 0.004), r() * sn, 0.3 + r() * 0.7);
    return dongu(x);
  },
  'ortam-kalabalik': (r) => {
    // Kalabalık uğultusu: farklı perdelerde, yavaşça dalgalanan bant gürültüleri
    const sn = 7; const n = Math.round(sn * SR); const x = new Float32Array(n);
    for (let v = 0; v < 6; v++) {
      const g = gurultu(n, r); const f = 350 + v * 180 + r() * 100; bantGecir(g, f, 3);
      const hz = 0.3 + r() * 0.8; const ph = r() * 6.28;
      for (let i = 0; i < n; i++) x[i] += g[i] * (0.6 + 0.4 * Math.sin((i / SR) * hz * 6.28 + ph));
    }
    return dongu(x, 0.8);
  },
  'ortam-ruzgar': (r) => {
    const sn = 7; const x = gurultu(Math.round(sn * SR), r);
    bantGecir(x, (i) => 500 + 300 * Math.sin((i / SR) * 0.9) + 150 * Math.sin((i / SR) * 2.3), 2.5);
    for (let i = 0; i < x.length; i++) x[i] *= 0.6 + 0.4 * Math.sin((i / SR) * 0.7);
    return dongu(x, 0.8);
  },
};

export const SFX_ADLARI = Object.keys(SESLER);
const SURUM = 1; // ses tarifleri değişirse artır (eski dosyalar yeniden üretilir)

export function sfxHazirla(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const isaret = path.join(dir, `surum-${SURUM}.txt`);
  const tamam = fs.existsSync(isaret);
  SFX_ADLARI.forEach((ad, k) => {
    const f = path.join(dir, `${ad}.wav`);
    if (tamam && fs.existsSync(f)) return;
    wavYaz(f, SESLER[ad](rng(1000 + k * 77)));
  });
  fs.writeFileSync(isaret, String(SURUM));
  return dir;
}
