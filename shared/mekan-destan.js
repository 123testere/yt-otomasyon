// Destan/aksiyon dizileri için mekânlar (ölçüden bağımsız: dikey ve yatay tuvalde çalışır).
// koy-gunduz, koy-yangin, kervan, tas-ocagi, zindan, avlu, arena, loca
import { h } from './dizi.js';
import { eo, pr, sahteCtx } from './cizim.js';

export const DESTAN_MEKANLAR = ['koy-gunduz', 'koy-yangin', 'kervan', 'tas-ocagi', 'zindan', 'avlu', 'arena', 'loca', 'merdiven', 'mahzen', 'kanal', 'sur'];

const rgba = (c, a) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function gok(ctx, W, H, renkler, ufuk = 0.62) {
  const g = ctx.createLinearGradient(0, 0, 0, H * ufuk);
  renkler.forEach((c, i) => g.addColorStop(i / (renkler.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function gunes(ctx, x, y, r, renk = '#FFE7A8') {
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 4);
  g.addColorStop(0, rgba(renk, 0.55)); g.addColorStop(1, rgba(renk, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = renk; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function tepeler(ctx, W, H, renkler, taban = 0.55) {
  renkler.forEach((renk, k) => {
    ctx.fillStyle = renk; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, H * (taban + k * 0.05) - Math.sin(x * 0.004 + k * 1.7) * H * 0.05 - h(x * 0.01 + k) * H * 0.015);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  });
}

function zemin(ctx, W, H, renk, y = 0.72) {
  ctx.fillStyle = renk; ctx.fillRect(0, H * y, W, H * (1 - y));
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let i = 0; i < 90; i++) { ctx.beginPath(); ctx.ellipse(h(i) * W, H * y + h(i * 3) * H * (1 - y), 22, 6, 0, 0, Math.PI * 2); ctx.fill(); }
}

// Basit ahşap ev; yanik: pencereler/ateş turuncu
function ev(ctx, x, y, w, hh, { duvar = '#7A5A3A', cati = '#5A2E22', isik = null, alev = 0, t = 0, seed = 1 } = {}) {
  ctx.fillStyle = duvar; ctx.fillRect(x, y - hh, w, hh);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
  for (let yy = y - hh + 20; yy < y; yy += 20) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  ctx.fillStyle = cati; ctx.beginPath(); ctx.moveTo(x - 24, y - hh); ctx.lineTo(x + w / 2, y - hh - w * 0.42); ctx.lineTo(x + w + 24, y - hh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = isik ?? '#2A2A30'; ctx.fillRect(x + w * 0.2, y - hh * 0.72, w * 0.22, hh * 0.3); ctx.fillRect(x + w * 0.58, y - hh * 0.72, w * 0.22, hh * 0.3);
  ctx.fillStyle = '#2A1A10'; ctx.fillRect(x + w * 0.42, y - hh * 0.45, w * 0.16, hh * 0.45);
  if (alev > 0) {
    for (let k = 0; k < 7; k++) {
      const fx = x + (k + 0.5) * (w / 7);
      const fh = (60 + h(k + seed) * 90) * alev * (0.8 + Math.sin(t * 9 + k * 2 + seed) * 0.2);
      for (const [r, c] of [[1, '#C8361A'], [0.7, '#F28A1E'], [0.4, '#FFD66A']]) {
        ctx.fillStyle = c; ctx.beginPath();
        ctx.moveTo(fx - 26 * r, y - hh - w * 0.2);
        ctx.quadraticCurveTo(fx - 12 * r, y - hh - w * 0.2 - fh * r, fx + Math.sin(t * 6 + k) * 8, y - hh - w * 0.2 - fh * 1.2 * r);
        ctx.quadraticCurveTo(fx + 14 * r, y - hh - w * 0.2 - fh * 0.8 * r, fx + 26 * r, y - hh - w * 0.2); ctx.closePath(); ctx.fill();
      }
    }
  }
}

function duman(ctx, W, H, t, renk = '#2A2228', yog = 1) {
  for (let i = 0; i < 12; i++) {
    const x = (h(i) * W + t * 25 * (0.5 + h(i * 2))) % (W + 400) - 200;
    const y = H * (0.15 + h(i * 3) * 0.35) - ((t * 20) % 200);
    const r = 120 + h(i * 5) * 160;
    const g = ctx.createRadialGradient(x, y, 10, x, y, r);
    g.addColorStop(0, rgba(renk, 0.45 * yog)); g.addColorStop(1, rgba(renk, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function kivilcim(ctx, W, H, t) {
  for (let i = 0; i < 70; i++) {
    const x = (h(i) * W + Math.sin(t + i) * 30) % W;
    const y = H - ((t * (60 + h(i * 2) * 90) + h(i * 3) * H) % H);
    ctx.fillStyle = `rgba(255,${150 + Math.floor(h(i) * 80)},60,${0.5 + 0.5 * h(i * 7)})`;
    ctx.fillRect(x, y, 3, 3);
  }
}

// Tribündeki kalabalık: kafalar ve kollar; heyecan (0-1) arttıkça kollar havaya kalkar ve zıplarlar
function kalabalik(ctx, W, y0, y1, t, heyecan = 0.5, gece = false) {
  const sira = 7;
  for (let r = 0; r < sira; r++) {
    const y = y0 + ((y1 - y0) * r) / (sira - 1);
    const boy = 16 + r * 3.5;
    const ara = boy * 2.1;
    for (let x = (r % 2) * ara * 0.5; x < W + ara; x += ara) {
      const i = r * 1000 + Math.floor(x);
      const zip = Math.max(0, Math.sin(t * (6 + h(i) * 4) + h(i) * 6)) * heyecan * boy * 0.5;
      const renk = gece ? `hsl(${Math.floor(h(i) * 360)},15%,${18 + h(i * 2) * 12}%)` : `hsl(${Math.floor(h(i) * 360)},35%,${42 + h(i * 2) * 20}%)`;
      ctx.fillStyle = renk;
      ctx.fillRect(x - boy * 0.45, y - boy * 0.2 - zip, boy * 0.9, boy * 1.4);
      ctx.fillStyle = gece ? '#5A5048' : '#E8C8A0';
      ctx.beginPath(); ctx.arc(x, y - boy * 0.55 - zip, boy * 0.42, 0, Math.PI * 2); ctx.fill();
      if (h(i * 5) < heyecan) {
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = boy * 0.22; ctx.lineCap = 'round';
        const k = Math.sin(t * 8 + i) * boy * 0.2;
        ctx.beginPath(); ctx.moveTo(x - boy * 0.4, y - boy * 0.1 - zip); ctx.lineTo(x - boy * 0.7 + k, y - boy * 1.2 - zip); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + boy * 0.4, y - boy * 0.1 - zip); ctx.lineTo(x + boy * 0.7 - k, y - boy * 1.2 - zip); ctx.stroke();
      }
    }
  }
}

function sancak(ctx, x, y, renk, t, seed) {
  ctx.strokeStyle = '#3A2A1A'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 160); ctx.stroke();
  ctx.fillStyle = renk; ctx.beginPath(); ctx.moveTo(x, y - 160);
  for (let k = 0; k <= 8; k++) ctx.lineTo(x + k * 12, y - 160 + Math.sin(t * 4 + k * 0.8 + seed) * 6);
  for (let k = 8; k >= 0; k--) ctx.lineTo(x + k * 12, y - 100 + Math.sin(t * 4 + k * 0.8 + seed) * 6);
  ctx.closePath(); ctx.fill();
}

// --- Ortak ayrıntılar -------------------------------------------------------------------------------------
// Düzensiz taş/tuğla duvar: sıralar halinde, her taş biraz farklı ton; harç çizgisi, üst kenar ışık, alt kenar gölge
function tasDuvar(ctx, x0, y0, x1, y1, { boy = 56, en = 110, renk = [52, 46, 44], oyna = 14, seed = 1 } = {}) {
  let sira = 0;
  for (let y = y0; y < y1; y += boy, sira++) {
    let x = x0 - h(sira * 7.1 + seed) * en;
    for (let k = 0; x < x1; k++) {
      const w = en * (0.7 + h(sira * 31 + k * 3.7 + seed) * 0.6);
      const v = (h(sira * 13 + k * 5.3 + seed) - 0.5) * oyna * 2;
      ctx.fillStyle = `rgb(${renk[0] + v},${renk[1] + v},${renk[2] + v * 0.9})`;
      ctx.fillRect(x + 2, y + 2, w - 4, boy - 4);
      ctx.fillStyle = 'rgba(255,240,220,.06)'; ctx.fillRect(x + 2, y + 2, w - 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 2, y + boy - 7, w - 4, 5);
      x += w;
    }
  }
}

// Duvar meşalesi: demir tutamak, sopa, titreyen alev ve çevresine sıcak ışık
function mesale(ctx, x, y, t, s = 1, seed = 1) {
  const tit = 0.85 + Math.sin(t * 9 + seed) * 0.08 + Math.sin(t * 23 + seed * 3) * 0.04;
  const g = ctx.createRadialGradient(x, y - 30 * s, 8, x, y - 30 * s, 420 * s);
  g.addColorStop(0, `rgba(255,170,80,${0.42 * tit})`); g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 420 * s, y - 450 * s, 840 * s, 840 * s);
  ctx.fillStyle = '#1A1614'; ctx.fillRect(x - 18 * s, y + 30 * s, 36 * s, 10 * s); ctx.fillRect(x - 4 * s, y + 10 * s, 8 * s, 30 * s);
  ctx.fillStyle = '#4A3020'; ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 20 * s); ctx.lineTo(x + 9 * s, y - 20 * s); ctx.lineTo(x + 5 * s, y + 34 * s); ctx.lineTo(x - 5 * s, y + 34 * s); ctx.closePath(); ctx.fill();
  for (const [r, c] of [[1, '#D8501A'], [0.68, '#F5A030'], [0.36, '#FFF0B0']]) {
    const hh = 62 * s * r * tit;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 16 * s * r, y - 20 * s);
    ctx.quadraticCurveTo(x - 14 * s * r, y - 20 * s - hh * 0.7, x + Math.sin(t * 7 + seed) * 6 * s, y - 20 * s - hh);
    ctx.quadraticCurveTo(x + 14 * s * r, y - 20 * s - hh * 0.6, x + 16 * s * r, y - 20 * s); ctx.closePath(); ctx.fill();
  }
}

function tozZerresi(ctx, x0, y0, w, hh, t, renk = '255,220,170', n = 28) {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((h(i) * w + t * 12 * (h(i * 3) - 0.5)) % w + w) % w;
    const y = y0 + ((h(i * 2) * hh - t * 8 * (0.5 + h(i * 5))) % hh + hh) % hh;
    ctx.fillStyle = `rgba(${renk},${0.25 + 0.35 * h(i * 7)})`; ctx.fillRect(x, y, 3, 3);
  }
}

// Ağır ahşap kapı (taş kemerde). Kendiliğinden açılmaz: k.ac anında itilmeye başlanır, k.sure saniyede ağır ağır açılır.
// Menteşe solda; açıldıkça kanat daralır, kenarı görünür, arkadan aşağı inen merdivenin ışığı sızar.
function agirKapi(ctx, W, H, u, k) {
  const gw = W * 0.14;
  const alt = H * 0.74;
  const ust = alt - H * 0.46;
  const gx = W * (k.x ?? 0.24) - gw / 2;
  const ham = k.ac === undefined ? 0 : pr(u, k.ac, k.ac + (k.sure ?? 1.8));
  const p = ham * ham * (3 - 2 * ham);
  const kemer = (pad) => { ctx.beginPath(); ctx.moveTo(gx - pad, alt); ctx.lineTo(gx - pad, ust + gw / 2); ctx.arc(gx + gw / 2, ust + gw / 2, gw / 2 + pad, Math.PI, 0); ctx.lineTo(gx + gw + pad, alt); ctx.closePath(); };
  // Taş çerçeve: kemer taşları ve yan bloklar
  ctx.fillStyle = '#5A524C'; kemer(30); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    const [cx, cy, r] = [gx + gw / 2, ust + gw / 2, gw / 2];
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r + 30), cy + Math.sin(a) * (r + 30)); ctx.stroke();
  }
  for (let y = ust + gw / 2; y < alt; y += 52) { for (const x of [gx - 30, gx + gw]) { ctx.strokeRect(x, y, 30, 52); } }
  // İç: karanlık, sola aşağı inen basamaklar, aşağıdan soğuk ışık
  ctx.save(); kemer(0); ctx.clip();
  const ig = ctx.createLinearGradient(0, ust, 0, alt);
  ig.addColorStop(0, '#040507'); ig.addColorStop(1, '#141820');
  ctx.fillStyle = ig; ctx.fillRect(gx, ust, gw, alt - ust);
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = `rgba(90,90,100,${0.55 - s * 0.08})`;
    ctx.fillRect(gx + gw * (0.15 + s * 0.06), alt - H * 0.03 * (s + 1), gw * 0.85, H * 0.012);
  }
  const mg = ctx.createRadialGradient(gx + gw * 0.2, alt, 4, gx + gw * 0.2, alt, gw);
  mg.addColorStop(0, 'rgba(120,160,220,.35)'); mg.addColorStop(1, 'rgba(120,160,220,0)');
  ctx.fillStyle = mg; ctx.fillRect(gx, ust, gw, alt - ust);
  // Kanat
  const acik = Math.cos(p * 1.42);
  const dw = gw * acik;
  ctx.fillStyle = '#5E3E24'; ctx.fillRect(gx, ust, dw, alt - ust);
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(gx + (dw * i) / 5, ust); ctx.lineTo(gx + (dw * i) / 5, alt); ctx.stroke(); }
  for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,220,170,.05)'; ctx.fillRect(gx + (dw * i) / 5 + 3, ust, 6 * acik, alt - ust); }
  for (const fy of [0.3, 0.75]) {
    const by = ust + (alt - ust) * fy;
    ctx.fillStyle = '#2A2626'; ctx.fillRect(gx, by, dw, 16);
    ctx.fillStyle = '#6A6266'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(gx + 10 + (dw - 20) * (i / 5), by + 8, 3.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // Halka tokmak ve kilit
  if (acik > 0.25) {
    const hx = gx + dw * 0.84; const hy = ust + (alt - ust) * 0.52;
    ctx.strokeStyle = '#1A1616'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(hx, hy + 18, 16 * acik, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2A2626'; ctx.fillRect(hx - 9 * acik, hy - 6, 18 * acik, 18); ctx.fillStyle = '#000'; ctx.fillRect(hx - 2, hy + 40, 4, 12);
  }
  ctx.fillStyle = `rgba(0,0,0,${0.55 * p})`; ctx.fillRect(gx, ust, dw, alt - ust);
  if (p > 0) { ctx.fillStyle = '#8A6640'; ctx.fillRect(gx + dw, ust, 16 * Math.sin(p * 1.42), alt - ust); }
  ctx.restore();
  // Açılırken eşikte kalkan toz
  if (p > 0.02 && p < 1) {
    for (let i = 0; i < 16; i++) {
      const r = 26 + h(i) * 50; const x = gx + h(i * 2) * gw; const y = alt - h(i * 5) * 30;
      const dg = ctx.createRadialGradient(x, y, 2, x, y, r);
      dg.addColorStop(0, `rgba(170,160,140,${0.3 * (1 - p)})`); dg.addColorStop(1, 'rgba(170,160,140,0)');
      ctx.fillStyle = dg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
}

// Taş merdiven: sağ üstten sol alta iner. Karakterler hareket.y ile basamak çizgisini izler:
// y = -0,28 × (x − 0,08) / 0,89  (x: 0,08 sol alt, 0,97 sağ üst)
export const merdivenY = (x) => -0.28 * (x - 0.08) / 0.89;
function merdivenMekan(ctx, W, H, t) {
  const ayak = W > H ? H * 0.84 : H * 0.745;
  const A = [W * 0.97, ayak - H * 0.28];
  const B = [W * 0.08, ayak];
  ctx.fillStyle = '#1E1A19'; ctx.fillRect(0, 0, W, H);
  tasDuvar(ctx, 0, 0, W, H, { boy: 58, en: 120, renk: [50, 45, 43], seed: 3 });
  // Tavan karanlığı
  const tg = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  tg.addColorStop(0, 'rgba(0,0,0,.75)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.35);
  // Üstteki kapıdan (zindan) sıcak ışık, aşağıdan (mahzen) soğuk ışık
  const ust = ctx.createRadialGradient(W, A[1] - H * 0.2, 10, W, A[1] - H * 0.2, W * 0.45);
  ust.addColorStop(0, 'rgba(255,170,90,.35)'); ust.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = ust; ctx.fillRect(0, 0, W, H);
  const alt = ctx.createRadialGradient(0, ayak, 10, 0, ayak, W * 0.4);
  alt.addColorStop(0, 'rgba(110,150,210,.3)'); alt.addColorStop(1, 'rgba(110,150,210,0)');
  ctx.fillStyle = alt; ctx.fillRect(0, 0, W, H);
  // Basamaklar
  const n = 16;
  const dx = (A[0] - B[0]) / n;
  const dy = (B[1] - A[1]) / n;
  ctx.beginPath(); ctx.moveTo(W, A[1]); ctx.lineTo(A[0], A[1]);
  for (let i = 0; i < n; i++) { const x = A[0] - dx * i; const y = A[1] + dy * i; ctx.lineTo(x - dx, y); ctx.lineTo(x - dx, y + dy); }
  ctx.lineTo(0, B[1]); ctx.lineTo(0, H); ctx.lineTo(W, H); ctx.closePath();
  ctx.fillStyle = '#3A3430'; ctx.fill();
  // Merdiven gövdesindeki taş sıraları (önden görünen yüz)
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
  for (let y = A[1]; y < H; y += 48) for (let x = (Math.floor(y / 48) % 2) * 60; x < W; x += 120) ctx.strokeRect(x, y, 120, 48);
  ctx.restore();
  for (let i = 0; i < n; i++) {
    const x = A[0] - dx * (i + 1); const y = A[1] + dy * i;
    ctx.fillStyle = '#6A625A'; ctx.fillRect(x, y - 2, dx, 9); // basamağın üst yüzü (aşınmış, açık)
    ctx.fillStyle = 'rgba(255,230,200,.12)'; ctx.fillRect(x + dx * 0.15, y - 2, dx * 0.5, 3);
    ctx.fillStyle = '#2A2522'; ctx.fillRect(x - 2, y + 7, 6, dy - 7); // rıht gölgesi
  }
  // Alt sahanlık
  ctx.fillStyle = '#4A4440'; ctx.fillRect(0, B[1] - 2, B[0], 9);
  // Korkuluk halatı ve demir halkalar
  const ly = (x) => A[1] + ((A[0] - x) / (A[0] - B[0])) * (B[1] - A[1]) - H * 0.27;
  ctx.strokeStyle = '#6A4E30'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  const kaz = [0.12, 0.34, 0.56, 0.78, 0.96].map((f) => W * f);
  for (let i = 0; i < kaz.length - 1; i++) {
    ctx.beginPath(); ctx.moveTo(kaz[i], ly(kaz[i])); ctx.quadraticCurveTo((kaz[i] + kaz[i + 1]) / 2, (ly(kaz[i]) + ly(kaz[i + 1])) / 2 + 30, kaz[i + 1], ly(kaz[i + 1])); ctx.stroke();
  }
  for (const x of kaz) { ctx.strokeStyle = '#2A2626'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, ly(x) - 6, 11, 0, Math.PI * 2); ctx.stroke(); }
  // Meşaleler duvarda, basamak hizasının üstünde
  for (const [f, sd] of [[0.3, 1], [0.72, 2]]) mesale(ctx, W * f, ly(W * f) - H * 0.17, t, H / 1080, sd);
  // Yosun ve su izi
  ctx.fillStyle = 'rgba(70,95,60,.35)';
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(h(i) * W, ly(h(i) * W) + H * 0.2 + h(i * 3) * 30, 30 + h(i * 2) * 40, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  tozZerresi(ctx, W * 0.55, A[1] - H * 0.45, W * 0.45, H * 0.5, t);
}

// Mahzen: tuğla tonozlar, şarap rafı, fıçı yığını, yerde akan su kanalı, sallanan fener, ortadaki kemerden çıkış ışığı.
function mahzenMekan(ctx, W, H, t) {
  const zy = W > H ? H * 0.7 : H * 0.62;
  ctx.fillStyle = '#1C1614'; ctx.fillRect(0, 0, W, H);
  tasDuvar(ctx, 0, 0, W, zy, { boy: 30, en: 72, renk: [74, 46, 36], oyna: 12, seed: 9 });
  // Üç kemerli bölme ve aralarındaki kalın sütunlar
  const kemerler = [[0.04, 0.32], [0.36, 0.64], [0.68, 0.96]];
  kemerler.forEach(([a, b], i) => {
    const x0 = W * a; const x1 = W * b; const r = (x1 - x0) / 2; const cx = x0 + r; const top = zy - H * 0.5;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x0, zy); ctx.lineTo(x0, top + r); ctx.arc(cx, top + r, r, Math.PI, 0); ctx.lineTo(x1, zy); ctx.closePath();
    ctx.fillStyle = i === 1 ? '#0E0C10' : '#140F0D'; ctx.fill(); ctx.clip();
    if (i === 1) {
      // Çıkış: uzakta, soğuk mavi-beyaz ışıklı küçük kemer ve ışık hüzmesi
      const er = r * 0.32; const ex = cx; const ey = zy - H * 0.06;
      const g = ctx.createRadialGradient(ex, ey - er, 4, ex, ey - er, r * 1.4);
      g.addColorStop(0, 'rgba(200,225,255,.6)'); g.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, top, x1 - x0, zy - top);
      ctx.fillStyle = '#D8E6F4'; ctx.beginPath(); ctx.moveTo(ex - er, ey); ctx.lineTo(ex - er, ey - er * 1.6); ctx.arc(ex, ey - er * 1.6, er, Math.PI, 0); ctx.lineTo(ex + er, ey); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(60,60,70,.5)'; ctx.fillRect(ex - er * (1.4 + k * 0.5), ey + k * 10, er * (2.8 + k), 6); }
    } else if (i === 0) {
      // Şarap rafı: ahşap ızgara ve şişe dipleri
      ctx.fillStyle = '#3A2414'; ctx.fillRect(x0 + r * 0.25, top + r * 0.6, r * 1.5, zy - top - r * 0.6);
      for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 6; xx++) {
        const bx = x0 + r * 0.38 + xx * r * 0.25; const by = top + r * 0.75 + yy * (zy - top - r * 0.8) / 7;
        ctx.fillStyle = h(xx * 7 + yy) < 0.82 ? '#1C3A22' : '#2A1A10'; ctx.beginPath(); ctx.arc(bx, by, r * 0.085, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(200,230,200,.25)'; ctx.fillRect(bx - 3, by - 6, 4, 4);
      }
    } else {
      // Fıçı yığını: alt sıra 3, üst sıra 2; çemberler ve tıpalar
      const fr = r * 0.3;
      const fici = (fx, fy) => {
        ctx.fillStyle = '#6A4426'; ctx.beginPath(); ctx.ellipse(fx, fy, fr, fr * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2A1A10'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = '#3A3638'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(fx, fy, fr * 0.72, fr * 0.76, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#8A6040'; ctx.beginPath(); ctx.ellipse(fx, fy, fr * 0.5, fr * 0.52, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2A1A10'; ctx.beginPath(); ctx.arc(fx, fy + fr * 0.25, 5, 0, Math.PI * 2); ctx.fill();
      };
      for (let k = 0; k < 3; k++) fici(x0 + r * 0.42 + k * fr * 2.05, zy - fr * 1.05);
      for (let k = 0; k < 2; k++) fici(x0 + r * 0.42 + fr * 1.02 + k * fr * 2.05, zy - fr * 3.05);
    }
    ctx.restore();
    // Kemer taşları
    ctx.strokeStyle = '#5A3A2A'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x0, zy); ctx.lineTo(x0, top + r); ctx.arc(cx, top + r, r, Math.PI, 0); ctx.lineTo(x1, zy); ctx.stroke();
  });
  // Tonoz tavan gölgesi ve ön kemer çerçevesi (derinlik)
  const tg = ctx.createLinearGradient(0, 0, 0, H * 0.3);
  tg.addColorStop(0, 'rgba(0,0,0,.85)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.3);
  ctx.fillStyle = '#120D0B'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.5);
  ctx.quadraticCurveTo(W * 0.97, H * 0.08, W / 2, H * 0.06); ctx.quadraticCurveTo(W * 0.03, H * 0.08, 0, H * 0.5); ctx.closePath(); ctx.fill();
  // Zemin: taş döşeme, duvar dibinde akan su kanalı
  ctx.fillStyle = '#2E2826'; ctx.fillRect(0, zy, W, H - zy);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3;
  for (let r = 0, y = zy + 30; y < H; r++, y += 30 + r * 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); for (let x = (r % 2) * 90; x < W; x += 180 + r * 30) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 30 + r * 14); ctx.stroke(); } }
  ctx.fillStyle = '#16202A'; ctx.fillRect(0, zy, W, H * 0.025);
  ctx.strokeStyle = 'rgba(160,190,220,.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const x = ((h(i) * W - t * 60) % W + W) % W; ctx.beginPath(); ctx.moveTo(x, zy + H * 0.012); ctx.lineTo(x + 30, zy + H * 0.012); ctx.stroke(); }
  // Çıkışın ışığı yere düşer
  const ex = W / 2;
  const lg = ctx.createRadialGradient(ex, zy + H * 0.08, 10, ex, zy + H * 0.08, W * 0.35);
  lg.addColorStop(0, 'rgba(200,225,255,.22)'); lg.addColorStop(1, 'rgba(200,225,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, zy, W, H - zy);
  // Su birikintileri
  ctx.fillStyle = 'rgba(120,150,190,.18)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W * (0.1 + h(i * 4) * 0.8), zy + H * (0.06 + h(i * 9) * 0.24), 70 + h(i) * 80, 12, 0, 0, Math.PI * 2); ctx.fill(); }
  // Sallanan fener (zincirle tavandan)
  const fx = W * 0.5 + Math.sin(t * 1.3) * 18; const fy = H * 0.22;
  ctx.strokeStyle = '#2A2626'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.06); ctx.lineTo(fx, fy - 30); ctx.stroke();
  const fg = ctx.createRadialGradient(fx, fy, 6, fx, fy, W * 0.3);
  fg.addColorStop(0, 'rgba(255,190,110,.38)'); fg.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2A2424'; ctx.fillRect(fx - 20, fy - 32, 40, 8); ctx.fillRect(fx - 20, fy + 24, 40, 8);
  ctx.fillStyle = '#FFD890'; ctx.fillRect(fx - 14, fy - 24, 28, 48);
  ctx.strokeStyle = '#2A2424'; ctx.lineWidth = 4; ctx.strokeRect(fx - 16, fy - 24, 32, 48);
  // Örümcek ağları köşelerde, damlayan su
  ctx.strokeStyle = 'rgba(220,220,220,.18)'; ctx.lineWidth = 1.5;
  for (const [cx, sx] of [[0, 1], [W, -1]]) {
    for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.arc(cx, 0, k * 34, sx > 0 ? 0 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI); ctx.stroke(); }
    for (let k = 0; k < 5; k++) { const a = (k / 4) * (Math.PI / 2) + (sx > 0 ? 0 : Math.PI / 2); ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.cos(a) * 170, Math.sin(a) * 170); ctx.stroke(); }
  }
  for (let i = 0; i < 4; i++) { const dx = W * (0.2 + i * 0.2); const f = (t * 0.8 + h(i)) % 1; ctx.fillStyle = 'rgba(170,200,230,.6)'; ctx.fillRect(dx, H * 0.08 + f * (zy - H * 0.08), 3, 8); }
}

// Zemin kapağı (zindan): kapalıyken yerde demir halkalı ahşap kapak; y.ac anında iki kişi kaldırmaya başlar,
// y.sure saniyede arka kenarından dikilir, altında aşağı inen merdivenin karanlığı ve yukarı süzülen serin sis görünür.
function yerKapagi(ctx, W, H, u, t, k) {
  const ayak = W > H ? H * 0.84 : H * 0.745;
  const gw = W * 0.15;
  const cx = W * (k.x ?? 0.5);
  const y = ayak - H * 0.035;
  const derin = H * 0.04;
  const ham = k.ac === undefined ? 0 : pr(u, k.ac, k.ac + (k.sure ?? 1.6));
  const p = ham * ham * (3 - 2 * ham);
  if (p > 0) {
    // Delik ve içindeki ilk basamaklar
    ctx.fillStyle = '#05060A'; ctx.beginPath(); ctx.ellipse(cx, y + derin / 2, gw / 2, derin / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, y + derin / 2, gw / 2, derin / 2, 0, 0, Math.PI * 2); ctx.clip();
    for (let s = 0; s < 3; s++) { ctx.fillStyle = `rgba(80,86,98,${0.6 - s * 0.18})`; ctx.fillRect(cx - gw * 0.35 + s * 14, y + derin * (0.35 + s * 0.2), gw * 0.6, 4); }
    ctx.restore();
    for (let i = 0; i < 7; i++) {
      const f = (t * 0.3 + h(i)) % 1;
      const r = 40 + h(i * 2) * 60;
      const mx = cx + (h(i * 3) - 0.5) * gw * 0.8;
      const my = y - f * H * 0.25;
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, r);
      g.addColorStop(0, `rgba(160,190,220,${0.22 * p * (1 - f)})`); g.addColorStop(1, 'rgba(160,190,220,0)');
      ctx.fillStyle = g; ctx.fillRect(mx - r, my - r, r * 2, r * 2);
    }
  }
  // Kapak: arka kenar menteşe; açıldıkça dikilir (görünen yükseklik artar, derinlik azalır)
  const yuk = gw * 0.55 * Math.sin(p * Math.PI / 2);
  const der = derin * Math.cos(p * Math.PI / 2);
  ctx.fillStyle = '#5A3C24';
  ctx.beginPath(); ctx.moveTo(cx - gw / 2, y - yuk); ctx.lineTo(cx + gw / 2, y - yuk); ctx.lineTo(cx + gw / 2 + 6, y + der); ctx.lineTo(cx - gw / 2 - 6, y + der); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.stroke();
  for (let i = 1; i < 5; i++) { const x = cx - gw / 2 + (gw * i) / 5; ctx.beginPath(); ctx.moveTo(x, y - yuk); ctx.lineTo(x, y + der); ctx.stroke(); }
  ctx.fillStyle = '#2A2626'; ctx.fillRect(cx - gw / 2, y - yuk + (yuk + der) * 0.35, gw, 7);
  ctx.strokeStyle = '#1A1616'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, y - yuk + (yuk + der) * 0.62, 14, 8 + yuk * 0.05, 0, 0, Math.PI * 2); ctx.stroke();
}

// Su kanalı: tuğla tonozlu tünel, arkada akan su, önde ıslak taş kenar yolu, solda çıkışı kapatan demir parmaklık
// ve arkasında ay ışığı. Duvarda su sızan borular, yosun, sis.
function kanalMekan(ctx, W, H, t) {
  const ayak = W > H ? H * 0.84 : H * 0.745;
  const suUst = ayak - H * 0.2;
  const suAlt = ayak - H * 0.09;
  ctx.fillStyle = '#141619'; ctx.fillRect(0, 0, W, H);
  tasDuvar(ctx, 0, 0, W, suUst, { boy: 30, en: 74, renk: [58, 50, 46], oyna: 10, seed: 21 });
  // Tonoz: üstte karanlık kemer
  ctx.fillStyle = '#0A0B0D'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.3);
  ctx.quadraticCurveTo(W / 2, -H * 0.12, 0, H * 0.3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3A302A'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, H * 0.3); ctx.quadraticCurveTo(W / 2, -H * 0.12, W, H * 0.3); ctx.stroke();
  // Yosun ve su lekeleri
  for (let i = 0; i < 18; i++) {
    const x = h(i * 3) * W; const y = H * (0.3 + h(i * 5) * 0.25);
    ctx.fillStyle = `rgba(60,90,55,${0.18 + h(i) * 0.2})`; ctx.fillRect(x, y, 6 + h(i * 7) * 10, suUst - y);
  }
  // Duvardan su akıtan borular
  for (const [f, sd] of [[0.45, 1], [0.78, 2]]) {
    const px = W * f; const py = suUst - H * 0.16;
    ctx.fillStyle = '#2A2422'; ctx.beginPath(); ctx.arc(px, py, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0A0808'; ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(150,180,210,.5)'; ctx.fillRect(px - 5, py, 10, suUst - py);
    for (let k = 0; k < 4; k++) { const d = (t * 1.5 + k * 0.25 + sd) % 1; ctx.fillStyle = 'rgba(200,220,240,.6)'; ctx.fillRect(px - 3, py + d * (suUst - py), 6, 10); }
  }
  // Çıkış: solda kemerli açıklık, ay ışığı ve kalın demir parmaklık
  const ex0 = W * 0.0; const ex1 = W * 0.17; const etop = ayak - H * 0.55;
  const ay = ctx.createLinearGradient(ex0, 0, ex1, 0);
  ay.addColorStop(0, '#9FB8D8'); ay.addColorStop(1, '#3A4A62');
  ctx.fillStyle = ay; ctx.beginPath(); ctx.moveTo(ex0, ayak); ctx.lineTo(ex0, etop + (ex1 - ex0) / 2); ctx.arc((ex0 + ex1) / 2, etop + (ex1 - ex0) / 2, (ex1 - ex0) / 2, Math.PI, 0); ctx.lineTo(ex1, ayak); ctx.closePath(); ctx.fill();
  const ag = ctx.createRadialGradient(ex1, ayak - H * 0.25, 10, ex1, ayak - H * 0.25, W * 0.45);
  ag.addColorStop(0, 'rgba(170,200,240,.35)'); ag.addColorStop(1, 'rgba(170,200,240,0)');
  ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#16181C';
  for (let x = ex0 + 14; x < ex1; x += (ex1 - ex0) / 6) ctx.fillRect(x, etop + 10, 14, ayak - etop);
  for (const fy of [0.35, 0.7]) ctx.fillRect(ex0, etop + (ayak - etop) * fy, ex1 - ex0, 14);
  ctx.strokeStyle = '#3A302A'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(ex1, ayak); ctx.lineTo(ex1, etop + (ex1 - ex0) / 2); ctx.arc((ex0 + ex1) / 2, etop + (ex1 - ex0) / 2, (ex1 - ex0) / 2, 0, Math.PI, true); ctx.stroke();
  // Akan su: koyu yeşil-mavi, sağdan sola akan ışık çizgileri, meşale yansımaları
  const sg = ctx.createLinearGradient(0, suUst, 0, suAlt);
  sg.addColorStop(0, '#1C2A2E'); sg.addColorStop(1, '#0E1618');
  ctx.fillStyle = sg; ctx.fillRect(0, suUst, W, suAlt - suUst);
  ctx.strokeStyle = 'rgba(170,200,220,.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = ((h(i) * W * 1.2 - t * (70 + h(i * 2) * 40)) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1;
    const y = suUst + 6 + h(i * 3) * (suAlt - suUst - 12);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 3, x + 40 + h(i) * 40, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,190,110,.12)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W * (0.3 + i * 0.12) + Math.sin(t * 2 + i) * 6, suUst + (suAlt - suUst) * 0.5, 40, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  // Suyun üstünde sis
  for (let i = 0; i < 10; i++) {
    const x = ((h(i) * W - t * 20) % W + W) % W; const r = 120 + h(i * 2) * 120;
    const g = ctx.createRadialGradient(x, suUst, 4, x, suUst, r);
    g.addColorStop(0, 'rgba(150,170,190,.14)'); g.addColorStop(1, 'rgba(150,170,190,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, suUst - r, r * 2, r * 2);
  }
  // Kenar yolu: taş bordür ve ıslak döşeme
  ctx.fillStyle = '#4A443E'; ctx.fillRect(0, suAlt, W, H * 0.025);
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 3;
  for (let x = 0; x < W; x += 110) ctx.strokeRect(x, suAlt, 110, H * 0.025);
  ctx.fillStyle = '#2E2A28'; ctx.fillRect(0, suAlt + H * 0.025, W, H);
  for (let r = 0, y = suAlt + H * 0.025 + 28; y < H; r++, y += 34 + r * 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(140,170,200,.12)';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(W * (0.12 + h(i * 4) * 0.8), suAlt + H * (0.08 + h(i * 9) * 0.1), 60 + h(i) * 70, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  tozZerresi(ctx, 0, H * 0.25, W * 0.4, H * 0.45, t, '200,220,250', 22);
}

// Zindanda gizli geçit: kapalıyken taş duvarın parçası (ince çatlak + gevşek taş + içeri çekilen toz),
// g.ac saniyesinde taş kapı 1,6 sn'de yana kayar, arkasında aşağı inen merdivenli karanlık geçit görünür.
function gizliGecit(ctx, W, H, u, g) {
  const gw = W * 0.13;
  const gx = W * (g.x ?? 0.42) - gw / 2;
  const alt = H * 0.74;
  const ust = alt - H * 0.4;
  const yol = () => { ctx.beginPath(); ctx.moveTo(gx, alt); ctx.lineTo(gx, ust + gw / 2); ctx.arc(gx + gw / 2, ust + gw / 2, gw / 2, Math.PI, 0); ctx.lineTo(gx + gw, alt); ctx.closePath(); };
  const p = g.ac === undefined ? 0 : eo(pr(u, g.ac, g.ac + 1.6));
  if (p > 0) {
    // Geçidin içi: karanlık, aşağı inen basamaklar, uzaktan soğuk mavi ışık
    ctx.save(); yol(); ctx.clip();
    const ig = ctx.createLinearGradient(0, ust, 0, alt);
    ig.addColorStop(0, '#05070C'); ig.addColorStop(1, '#0E1622');
    ctx.fillStyle = ig; ctx.fillRect(gx, ust, gw, alt - ust);
    const mg = ctx.createRadialGradient(gx + gw / 2, alt - H * 0.05, 5, gx + gw / 2, alt - H * 0.05, gw * 0.9);
    mg.addColorStop(0, `rgba(120,170,230,${0.45 * p})`); mg.addColorStop(1, 'rgba(120,170,230,0)');
    ctx.fillStyle = mg; ctx.fillRect(gx, ust, gw, alt - ust);
    for (let k = 0; k < 7; k++) {
      const y = alt - k * H * 0.028; const ic = k * gw * 0.045;
      ctx.fillStyle = `rgba(70,80,96,${0.75 - k * 0.09})`; ctx.fillRect(gx + ic, y - H * 0.012, gw - ic * 2, H * 0.012);
    }
    ctx.restore();
  }
  // Taş kapı (duvarla aynı doku); açılırken sola kayıp duvarın içine girer
  ctx.save(); yol(); ctx.clip();
  ctx.translate(-p * gw * 1.05, 0);
  ctx.fillStyle = '#2C282A'; ctx.fillRect(gx, ust, gw, alt - ust);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4;
  for (let y = 20; y < alt; y += 60) for (let x = (y / 60) % 2 ? 0 : 50; x < W; x += 100) if (x + 100 > gx && x < gx + gw && y + 60 > ust) ctx.strokeRect(x, y, 100, 60);
  // Gevşek taş (kolu): kapı kapalıyken hafif parlar
  const tx = gx + gw - 70; const ty = alt - H * 0.22;
  ctx.fillStyle = '#4A4246'; ctx.fillRect(tx, ty, 58, 36);
  ctx.strokeStyle = `rgba(255,200,120,${0.25 + 0.2 * Math.sin(u * 3)})`; ctx.lineWidth = 3; ctx.strokeRect(tx, ty, 58, 36);
  ctx.restore();
  // Kapalıyken: kapının çevresinde ince çatlak ve içeri çekilen toz (gizli ama dikkatli göz fark eder)
  if (p < 1) {
    ctx.save(); ctx.globalAlpha = 0.45 * (1 - p); yol(); ctx.strokeStyle = '#0A0809'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    for (let i = 0; i < 10; i++) {
      const f = (u * 0.35 + h(i)) % 1;
      ctx.fillStyle = `rgba(210,200,180,${0.35 * (1 - f) * (1 - p)})`;
      ctx.fillRect(gx + gw + 40 - f * 46, ust + h(i * 3) * (alt - ust), 3, 3);
    }
  }
  // Açılırken yerden kalkan toz
  if (p > 0 && p < 1) {
    for (let i = 0; i < 26; i++) {
      const r = 30 + h(i) * 70;
      const x = gx + h(i * 2) * gw * 1.3 - gw * 0.15;
      const y = alt - h(i * 5) * 50 - p * 40;
      const dg = ctx.createRadialGradient(x, y, 2, x, y, r);
      dg.addColorStop(0, `rgba(180,170,150,${0.35 * (1 - p)})`); dg.addColorStop(1, 'rgba(180,170,150,0)');
      ctx.fillStyle = dg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
}

// o: { W, H, t, u (sahne saniyesi), kamera (0-1), kalabalik (heyecan 0-1), gecit: {x, ac} }
export function destanMekan(ctx, ad, o = {}) {
  const { W = 1920, H = 1080, t = 0, u = t, kamera = 0, kalabalik: hey = 0.5 } = o;
  if (ad === 'sur') ad = 'avlu'; // gece suru hazır 3B görüntüyle çizilir (uc-boyut.js); görüntü yoksa avlu
  ctx.save();
  // Merdivende yakınlaşma yok: karakterlerin ayakları basamak çizgisinde kalmalı
  const z = ad === 'merdiven' ? 1 : 1 + Math.min(1, kamera) * 0.05;
  ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.55);
  const yer = H * 0.74;

  if (ad === 'merdiven') {
    merdivenMekan(ctx, W, H, t);
  } else if (ad === 'kanal') {
    kanalMekan(ctx, W, H, t);
  } else if (ad === 'mahzen') {
    mahzenMekan(ctx, W, H, t);
  } else if (ad === 'koy-gunduz') {
    gok(ctx, W, H, ['#6FA8DC', '#A9CCE8', '#E6EEF2']);
    gunes(ctx, W * 0.82, H * 0.16, H * 0.06);
    tepeler(ctx, W, H, ['#6E8F6A', '#557A52'], 0.5);
    zemin(ctx, W, H, '#8A7A52', 0.72);
    ev(ctx, W * 0.04, yer, W * 0.16, H * 0.22, { seed: 1 });
    ev(ctx, W * 0.74, yer, W * 0.18, H * 0.25, { duvar: '#8A6A44', seed: 2 });
    // Demirci örsü
    ctx.fillStyle = '#2E2E34'; ctx.fillRect(W * 0.62, yer - 70, 110, 34); ctx.fillRect(W * 0.62 + 35, yer - 36, 40, 36);
  } else if (ad === 'koy-yangin') {
    gok(ctx, W, H, ['#0A0608', '#2A0E0A', '#7A2A12']);
    tepeler(ctx, W, H, ['#1A0C0C', '#120808'], 0.52);
    zemin(ctx, W, H, '#1E1410', 0.72);
    const g = ctx.createRadialGradient(W / 2, yer, 50, W / 2, yer, W * 0.7);
    g.addColorStop(0, 'rgba(255,120,40,.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ev(ctx, W * 0.04, yer, W * 0.16, H * 0.22, { duvar: '#2A1A14', cati: '#1A0E0A', isik: '#FF8A2A', alev: 1, t, seed: 3 });
    ev(ctx, W * 0.74, yer, W * 0.18, H * 0.25, { duvar: '#2A1A14', cati: '#1A0E0A', isik: '#FF8A2A', alev: 0.8, t, seed: 5 });
    duman(ctx, W, H, t, '#1A1214', 1.2);
    kivilcim(ctx, W, H, t);
  } else if (ad === 'kervan') {
    gok(ctx, W, H, ['#C88A4A', '#E8B070', '#F2D2A0']);
    gunes(ctx, W * 0.2, H * 0.22, H * 0.07, '#FFF0C8');
    // Kum tepeleri
    tepeler(ctx, W, H, ['#D8A868', '#C89458'], 0.58);
    zemin(ctx, W, H, '#C8945A', 0.72);
    // Toz
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(240,210,160,${0.15 * h(i)})`;
      const x = (h(i) * W + t * 60) % W;
      ctx.beginPath(); ctx.ellipse(x, H * (0.72 + h(i * 2) * 0.2), 80, 18, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (ad === 'tas-ocagi') {
    gok(ctx, W, H, ['#8A9AA8', '#B8C0C4', '#D8D4CA']);
    // Kayalık duvarlar
    ctx.fillStyle = '#8A8070';
    ctx.beginPath(); ctx.moveTo(0, H * 0.15); ctx.lineTo(W * 0.3, H * 0.3); ctx.lineTo(W * 0.25, H * 0.74); ctx.lineTo(0, H * 0.74); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H * 0.12); ctx.lineTo(W * 0.68, H * 0.32); ctx.lineTo(W * 0.74, H * 0.74); ctx.lineTo(W, H * 0.74); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 4;
    for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.moveTo(h(k) * W * 0.25, H * (0.3 + k * 0.04)); ctx.lineTo(h(k) * W * 0.25 + 120, H * (0.32 + k * 0.04)); ctx.stroke(); }
    zemin(ctx, W, H, '#A89A80', 0.72);
    for (let k = 0; k < 9; k++) { ctx.fillStyle = '#9A9080'; ctx.fillRect(W * (0.3 + h(k) * 0.4), yer + h(k * 2) * 60, 60 + h(k * 3) * 40, 40); }
  } else if (ad === 'zindan' || ad === 'avlu') {
    const zindan = ad === 'zindan';
    ctx.fillStyle = zindan ? '#2A2628' : '#8A7A62'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4;
    for (let y = 20; y < H * 0.74; y += 60) for (let x = (y / 60) % 2 ? 0 : 50; x < W; x += 100) ctx.strokeRect(x, y, 100, 60);
    if (zindan) {
      gizliGecit(ctx, W, H, u, o.gecit ?? { x: 0.42 });
      if (o.kapi) agirKapi(ctx, W, H, u, o.kapi);
      // Meşale ışığı ve parmaklık
      const tit = 0.85 + Math.sin(t * 9) * 0.07;
      const g = ctx.createRadialGradient(W * 0.15, H * 0.35, 10, W * 0.15, H * 0.35, W * 0.6);
      g.addColorStop(0, `rgba(255,170,80,${0.45 * tit})`); g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#F2A23A'; ctx.beginPath(); ctx.ellipse(W * 0.15, H * 0.3, 14, 28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3A2A1A'; ctx.fillRect(W * 0.15 - 8, H * 0.32, 16, 70);
      ctx.fillStyle = '#1A1618';
      for (let x = W * 0.62; x < W; x += 70) ctx.fillRect(x, 0, 16, H * 0.74);
      ctx.fillRect(W * 0.62, H * 0.1, W * 0.4, 16);
    } else {
      gok(ctx, W, H * 0.4, ['#8AB4D8', '#C8DCE8']);
      ctx.fillStyle = '#7A6A52'; ctx.fillRect(0, H * 0.25, W, H * 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      for (let y = H * 0.25; y < H * 0.74; y += 60) for (let x = (y / 60) % 2 ? 0 : 50; x < W; x += 100) ctx.strokeRect(x, y, 100, 60);
      // Antrenman kazıkları
      for (const fx of [0.12, 0.88]) { ctx.fillStyle = '#5A3A1E'; ctx.fillRect(W * fx - 16, yer - 220, 32, 220); ctx.fillRect(W * fx - 70, yer - 170, 140, 22); }
    }
    zemin(ctx, W, H, zindan ? '#1E1A1C' : '#C8B080', 0.74);
    // Zemin kapağı zeminden sonra çizilir (yoksa zemin üstünü örter)
    if (zindan && o.yerKapak) yerKapagi(ctx, W, H, u, t, o.yerKapak);
  } else if (ad === 'arena' || ad === 'loca') {
    gok(ctx, W, H, ['#5E9AD0', '#9AC4E4', '#DCE8EE'], 0.4);
    gunes(ctx, W * 0.5, H * 0.08, H * 0.05, '#FFF4D0');
    // Tribün duvarı ve kalabalık
    ctx.fillStyle = '#B89870'; ctx.fillRect(0, H * 0.12, W, H * 0.48);
    kalabalik(ctx, W, H * 0.2, H * 0.52, t, hey);
    ctx.fillStyle = '#8A6A48'; ctx.fillRect(0, H * 0.54, W, H * 0.06);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
    for (let x = 0; x < W; x += 80) ctx.strokeRect(x, H * 0.54, 80, H * 0.06);
    for (const [fx, c] of [[0.1, '#A82A2A'], [0.35, '#E2B23C'], [0.65, '#A82A2A'], [0.9, '#E2B23C']]) sancak(ctx, W * fx, H * 0.54, c, t, fx * 10);
    if (ad === 'loca') {
      // Kral locası: tente ve korkuluk (karakterler önde durur)
      ctx.fillStyle = '#5A1E3A';
      ctx.beginPath(); ctx.moveTo(W * 0.1, H * 0.1); ctx.lineTo(W * 0.9, H * 0.1); ctx.lineTo(W * 0.85, H * 0.22); ctx.lineTo(W * 0.15, H * 0.22); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#E2B23C' : '#5A1E3A'; ctx.fillRect(W * (0.15 + k * 0.07), H * 0.22, W * 0.07, 22); }
      zemin(ctx, W, H, '#6A4A3A', 0.6);
      ctx.fillStyle = '#4A2E22'; ctx.fillRect(0, H * 0.84, W, H * 0.16);
    } else {
      zemin(ctx, W, H, '#E2C890', 0.6);
      ctx.fillStyle = 'rgba(120,90,50,.25)';
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(h(i) * W, H * (0.62 + h(i * 2) * 0.36), 40, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.restore();
  // Kenar kararması
  const v = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, ad === 'zindan' || ad === 'koy-yangin' || ad === 'merdiven' || ad === 'mahzen' || ad === 'kanal' ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// --- Özel mekânlar ------------------------------------------------------------------------------------------
// Hikâyede listede olmayan bir yer geçtiğinde senaryo yazarı onu kodla çizer: mekanlar/<ad>.json { ad, aciklama, kod }.
// Kod tam ekranı çizer; kullanabileceği adlar: ctx, W, H, t (video sn), u (sahne sn), ayak (karakterlerin ayak hizası),
// h(n) tohumlu rastgele, eo/pr yumuşatma, tasDuvar(x0,y0,x1,y1,{boy,en,renk:[r,g,b],oyna,seed}), mesale(x,y,t,olcek,seed),
// toz(x0,y0,w,h,t,'r,g,b',adet). Math.random/Date/fetch/döngüde while yasak.
const MK_ADLAR = ['ctx', 'W', 'H', 't', 'u', 'ayak', 'h', 'eo', 'pr', 'tasDuvar', 'mesale', 'toz'];
const mkOnbellek = new Map();
export function mekanDerle(kod) {
  if (mkOnbellek.has(kod)) return mkOnbellek.get(kod);
  // eslint-disable-next-line no-new-func
  const f = new Function(...MK_ADLAR, `"use strict";\n${kod}`);
  const ciz = (ctx, { W, H, t = 0, u = 0 }) => f(ctx, W, H, t, u, W > H ? H * 0.84 : H * 0.745, h, eo, pr,
    (...a) => tasDuvar(ctx, ...a), (...a) => mesale(ctx, ...a), (...a) => tozZerresi(ctx, ...a));
  mkOnbellek.set(kod, ciz);
  return ciz;
}
export function mekanKodHatasi(kod) {
  if (typeof kod !== 'string' || !kod.trim()) return 'kod boş';
  if (kod.length > 15000) return 'kod 15000 karakteri geçmemeli';
  if (/\b(fetch|XMLHttpRequest|import|require|document|window|globalThis|eval|Function|setTimeout|setInterval|while)\b/.test(kod)) return 'fetch/import/document/window/eval/while kullanılamaz';
  if (/Math\.random|Date\.now|new Date/.test(kod)) return 'Math.random/Date kullanma; rastgelelik için h(n)';
  let f;
  try { f = mekanDerle(kod); } catch (e) { return `sözdizimi hatası: ${e.message}`; }
  try {
    for (const [W, H] of [[1920, 1080], [1080, 1920]]) for (const u of [0, 1.3, 4]) f(sahteCtx(), { W, H, t: 2 + u, u });
  } catch (e) { return `çalışma hatası: ${e.message}`; }
  return null;
}
