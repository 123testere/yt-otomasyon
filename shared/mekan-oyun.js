// Oyun hikâyeleri için mekânlar (ölçüden bağımsız: dikey ve yatay tuvalde çalışır).
// garaj (evde kurulan stüdyo), ofis (oyun stüdyosu), oyun-salonu (atari salonu), fuar (oyun fuarı sahnesi), grafik (satış grafiği)
import { h } from './dizi.js';

export const OYUN_MEKANLAR = ['garaj', 'ofis', 'oyun-salonu', 'fuar', 'grafik'];

const NEON = ['#FF3EA5', '#3EE0FF', '#FFE03E', '#7CFF5A', '#A86BFF'];

function dikdortgen(ctx, x, y, w, hh, renk) { ctx.fillStyle = renk; ctx.fillRect(x, y, w, hh); }

function zemin(ctx, W, H, renk, y, cizgi = 'rgba(0,0,0,.18)') {
  ctx.fillStyle = renk; ctx.fillRect(0, H * y, W, H * (1 - y));
  ctx.strokeStyle = cizgi; ctx.lineWidth = 3;
  for (let k = 1; k < 8; k++) { const yy = H * y + (H * (1 - y)) * (k / 8) ** 1.6; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
}

// Masa ve üstünde ışıldayan monitör; ekranda kayan kod satırları ya da piksel oyun
function masa(ctx, x, y, w, t, seed, { crt = false, ekran = 'kod' } = {}) {
  const mh = w * 0.42;
  dikdortgen(ctx, x, y - w * 0.04, w, w * 0.05, '#5A3E2A');
  dikdortgen(ctx, x + w * 0.06, y, w * 0.05, w * 0.32, '#3E2A1C');
  dikdortgen(ctx, x + w * 0.89, y, w * 0.05, w * 0.32, '#3E2A1C');
  const mx = x + w * 0.22;
  const mw = w * 0.56;
  const my = y - w * 0.04 - mh;
  // Ekran ışığı
  const g = ctx.createRadialGradient(mx + mw / 2, my + mh / 2, 10, mx + mw / 2, my + mh / 2, w * 1.1);
  g.addColorStop(0, 'rgba(120,200,255,.28)'); g.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = g; ctx.fillRect(mx - w, my - w, mw + 2 * w, mh + 2 * w);
  ctx.fillStyle = crt ? '#C8C0A8' : '#1A1A22';
  ctx.beginPath(); ctx.roundRect(mx - 10, my - 10, mw + 20, mh + 20, crt ? 18 : 8); ctx.fill();
  if (crt) dikdortgen(ctx, mx + mw * 0.1, my + mh + 10, mw * 0.8, w * 0.04, '#B0A890');
  else dikdortgen(ctx, mx + mw * 0.45, my + mh + 10, mw * 0.1, w * 0.04, '#2A2A32');
  dikdortgen(ctx, mx, my, mw, mh, crt ? '#0E2A14' : '#0C1428');
  ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  if (ekran === 'kod') {
    for (let k = 0; k < 9; k++) {
      const yy = my + ((k * mh) / 8 + t * 22 + seed * 7) % (mh + 10);
      ctx.fillStyle = crt ? '#5AFF7A' : NEON[(k + seed) % NEON.length];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(mx + 8 + h(k + seed) * 20, yy, mw * (0.25 + h(k * 3 + seed) * 0.55), mh * 0.05);
    }
  } else {
    // Piksel oyun: zıplayan kare karakter ve platformlar
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2A6A2A'; ctx.fillRect(mx, my + mh * 0.8, mw, mh * 0.2);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#8A5A2A'; ctx.fillRect(mx + ((k * mw) / 3 + mw - ((t * 60) % mw)) % mw, my + mh * 0.5, mw * 0.18, mh * 0.08); }
    const zip = Math.abs(Math.sin(t * 3 + seed)) * mh * 0.3;
    ctx.fillStyle = '#FF4A3A'; ctx.fillRect(mx + mw * 0.3, my + mh * 0.68 - zip, mw * 0.08, mh * 0.12);
  }
  ctx.restore();
  // Klavye
  dikdortgen(ctx, x + w * 0.3, y - w * 0.07, w * 0.4, w * 0.03, crt ? '#B8B098' : '#2A2A34');
}

function arcade(ctx, x, y, w, t, seed) {
  const hh = w * 2.1;
  const renk = NEON[seed % NEON.length];
  ctx.fillStyle = '#16121E';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - hh * 0.62); ctx.lineTo(x + w * 0.12, y - hh * 0.72); ctx.lineTo(x + w * 0.12, y - hh);
  ctx.lineTo(x + w * 0.88, y - hh); ctx.lineTo(x + w * 0.88, y - hh * 0.72); ctx.lineTo(x + w, y - hh * 0.62); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = renk; ctx.lineWidth = 4; ctx.stroke();
  // Üst ışıklı tabela
  ctx.fillStyle = renk; ctx.globalAlpha = 0.8 + Math.sin(t * 5 + seed) * 0.2; ctx.fillRect(x + w * 0.16, y - hh * 0.97, w * 0.68, hh * 0.08); ctx.globalAlpha = 1;
  // Ekran
  const ex = x + w * 0.18;
  const ey = y - hh * 0.85;
  const ew = w * 0.64;
  const eh = hh * 0.2;
  ctx.fillStyle = '#081018'; ctx.fillRect(ex, ey, ew, eh);
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = NEON[(k + seed) % NEON.length];
    const px = ex + ((h(k + seed) * ew + t * (40 + k * 10)) % ew);
    ctx.fillRect(px, ey + h(k * 2 + seed) * eh * 0.8, ew * 0.07, ew * 0.07);
  }
  // Kumanda paneli
  ctx.fillStyle = '#2A2238'; ctx.fillRect(x + w * 0.05, y - hh * 0.6, w * 0.9, hh * 0.08);
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(x + w * 0.3, y - hh * 0.57, w * 0.05, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 3; k++) { ctx.fillStyle = NEON[(k + 2) % NEON.length]; ctx.beginPath(); ctx.arc(x + w * (0.55 + k * 0.12), y - hh * 0.56, w * 0.035, 0, Math.PI * 2); ctx.fill(); }
}

function kalabalik(ctx, W, y, t, hey, renkTon = 0.7) {
  for (let sira = 0; sira < 3; sira++) {
    const r = 26 - sira * 4;
    for (let k = 0; k < W / (r * 2.2); k++) {
      const x = k * r * 2.2 + (sira % 2) * r + h(k + sira * 50) * 8;
      const zip = Math.max(0, Math.sin(t * (5 + h(k) * 3) + k)) * 10 * hey;
      const yy = y - sira * r * 1.6 - zip;
      const c = Math.floor(30 + h(k * 7 + sira) * 40 * renkTon);
      ctx.fillStyle = `rgb(${c},${c},${c + 12})`;
      ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - r * 1.1, yy + r * 0.8, r * 2.2, r * 2.4);
      if (hey > 0.6 && h(k + sira) > 0.7) { ctx.fillRect(x + r * 0.6, yy - r * 2.4 - zip, r * 0.4, r * 2); }
      if (h(k * 3 + sira) > 0.92) { ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 8 + k) * 0.5})`; ctx.fillRect(x - 6, yy - r * 1.6, 12, 18); }
    }
  }
}

// o: { W, H, t, kamera (0-1), kalabalik (heyecan 0-1), veri: [sayılar] (grafik için) }
export function oyunMekan(ctx, ad, o = {}) {
  const { W = 1920, H = 1080, t = 0, kamera = 0, kalabalik: hey = 0.5 } = o;
  const dikey = H > W;
  const zy = dikey ? 0.7 : 0.72; // zemin çizgisi
  const yer = H * zy;
  ctx.save();
  const z = 1 + Math.min(1, kamera) * 0.05;
  ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.55);
  const mw = dikey ? W * 0.5 : W * 0.24; // masa genişliği

  if (ad === 'garaj') {
    // Oluklu garaj kapısı, tek ampul, karton kutular
    dikdortgen(ctx, 0, 0, W, H, '#2A2622');
    ctx.fillStyle = '#3A342C'; ctx.fillRect(W * 0.08, H * 0.12, W * 0.84, yer - H * 0.12);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 5;
    for (let y = H * 0.12; y < yer; y += H * 0.035) { ctx.beginPath(); ctx.moveTo(W * 0.08, y); ctx.lineTo(W * 0.92, y); ctx.stroke(); }
    const sall = Math.sin(t * 1.5) * 0.04;
    const ax = W * 0.5 + Math.sin(sall) * H * 0.1;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.5, 0); ctx.lineTo(ax, H * 0.1); ctx.stroke();
    const g = ctx.createRadialGradient(ax, H * 0.11, 5, ax, H * 0.4, H * 0.7);
    g.addColorStop(0, 'rgba(255,220,150,.45)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFE8A8'; ctx.beginPath(); ctx.arc(ax, H * 0.11, H * 0.012, 0, Math.PI * 2); ctx.fill();
    zemin(ctx, W, H, '#4A443C', zy);
    for (let k = 0; k < 3; k++) {
      const bx = W * (dikey ? 0.72 : 0.82) + k * W * 0.02;
      const bs = H * (0.07 - k * 0.012);
      const by = yer - k * H * 0.06;
      ctx.fillStyle = '#A8824E'; ctx.fillRect(bx, by - bs, bs * 1.4, bs);
      ctx.strokeStyle = '#6A5030'; ctx.lineWidth = 3; ctx.strokeRect(bx, by - bs, bs * 1.4, bs);
    }
    masa(ctx, dikey ? W * 0.06 : W * 0.06, yer, mw, t, 1, { crt: true, ekran: 'oyun' });
  } else if (ad === 'ofis') {
    // Gece pencereli oyun stüdyosu; sıra sıra masalar, panoda yapışkan notlar
    dikdortgen(ctx, 0, 0, W, H, '#1C2230');
    const pw = dikey ? W * 0.84 : W * 0.5;
    const px = dikey ? W * 0.08 : W * 0.06;
    ctx.fillStyle = '#0A1020'; ctx.fillRect(px, H * 0.08, pw, H * 0.3);
    for (let k = 0; k < 26; k++) {
      const bx = px + h(k) * pw;
      const bh = H * (0.06 + h(k * 2) * 0.16);
      ctx.fillStyle = '#141C30'; ctx.fillRect(bx, H * 0.38 - bh, pw * 0.06, bh);
      for (let p = 0; p < 4; p++) if (h(k * 9 + p) > 0.5) { ctx.fillStyle = 'rgba(255,220,140,.7)'; ctx.fillRect(bx + 6 + p * 6, H * 0.38 - bh + 10 + p * 14, 4, 6); }
    }
    ctx.strokeStyle = '#3A4458'; ctx.lineWidth = 8; ctx.strokeRect(px, H * 0.08, pw, H * 0.3);
    ctx.beginPath(); ctx.moveTo(px + pw / 2, H * 0.08); ctx.lineTo(px + pw / 2, H * 0.38); ctx.stroke();
    if (!dikey) {
      ctx.fillStyle = '#E8E8E0'; ctx.fillRect(W * 0.62, H * 0.1, W * 0.3, H * 0.26);
      for (let k = 0; k < 9; k++) { ctx.fillStyle = NEON[k % NEON.length]; ctx.save(); ctx.translate(W * (0.64 + (k % 3) * 0.09), H * (0.13 + Math.floor(k / 3) * 0.075)); ctx.rotate((h(k) - 0.5) * 0.2); ctx.fillRect(0, 0, W * 0.06, H * 0.055); ctx.restore(); }
    }
    zemin(ctx, W, H, '#2A3040', zy);
    const n = dikey ? 2 : 3;
    for (let k = 0; k < n; k++) masa(ctx, W * (dikey ? 0.02 + k * 0.48 : 0.04 + k * 0.33), yer - H * 0.03, mw * (dikey ? 0.95 : 1), t, k + 2, { ekran: k % 2 ? 'oyun' : 'kod' });
  } else if (ad === 'oyun-salonu') {
    // Atari salonu: mor karanlık, neon şerit, sıra sıra oyun makineleri
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120A22'); g.addColorStop(1, '#2A1440');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 2; k++) { ctx.strokeStyle = NEON[k]; ctx.globalAlpha = 0.7 + Math.sin(t * 4 + k) * 0.3; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, H * (0.08 + k * 0.03)); ctx.lineTo(W, H * (0.08 + k * 0.03)); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // Dama zemin
    ctx.fillStyle = '#1A1020'; ctx.fillRect(0, yer, W, H - yer);
    const kare = W / 12;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 13; c++) if ((r + c) % 2) { ctx.fillStyle = '#3A2450'; ctx.fillRect(c * kare, yer + r * kare * 0.5, kare, kare * 0.5); }
    const aw = dikey ? W * 0.22 : W * 0.1;
    const n = Math.floor(W / (aw * 1.25));
    for (let k = 0; k < n; k++) arcade(ctx, k * aw * 1.25 + aw * 0.15, yer, aw, t, k);
  } else if (ad === 'fuar') {
    // Oyun fuarı: dev ekranlı sahne, dönen spot ışıkları, kalabalık
    dikdortgen(ctx, 0, 0, W, H, '#07070E');
    const sw = dikey ? W * 0.86 : W * 0.6;
    const sx = (W - sw) / 2;
    const sh = H * (dikey ? 0.2 : 0.36);
    const sy = H * 0.1;
    const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    g.addColorStop(0, '#1A3AFF'); g.addColorStop(0.5 + Math.sin(t) * 0.3, '#A83AFF'); g.addColorStop(1, '#FF3A8A');
    ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#2A2A3A'; ctx.lineWidth = 14; ctx.strokeRect(sx, sy, sw, sh);
    for (let k = 0; k < 14; k++) { ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.15 * Math.sin(t * 3 + k)})`; ctx.fillRect(sx + h(k) * sw * 0.9, sy + h(k * 4) * sh * 0.8, sw * 0.05, sw * 0.05); }
    for (const [fx, f] of [[0.15, 1], [0.85, -1]]) {
      const a = Math.sin(t * 1.2 * f) * 0.35 - 0.1 * f;
      ctx.save(); ctx.translate(W * fx, 0); ctx.rotate(a);
      const sg = ctx.createLinearGradient(0, 0, 0, H * 0.8);
      sg.addColorStop(0, 'rgba(255,255,230,.45)'); sg.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(W * 0.14, H * 0.8); ctx.lineTo(-W * 0.14, H * 0.8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Sahne zemini ve önde kalabalık (karakterler sahnede durur)
    ctx.fillStyle = '#1E1E2A'; ctx.fillRect(0, yer, W, H - yer);
    ctx.fillStyle = '#3A3A5A'; ctx.fillRect(0, yer, W, 8);
    kalabalik(ctx, W, H * (dikey ? 0.62 : 0.66), t, hey);
  } else if (ad === 'grafik') {
    // Satış grafiği: ızgara üzerinde yükselen çubuklar ve ok
    dikdortgen(ctx, 0, 0, W, H, '#0A1424');
    ctx.strokeStyle = 'rgba(80,140,220,.18)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += W / 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += W / 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const veri = o.veri?.length ? o.veri : [1, 1.6, 2.4, 4, 7];
    const max = Math.max(...veri);
    const gx = W * 0.1;
    const gw = W * 0.8;
    const taban = yer - H * 0.02;
    const tepe = H * (dikey ? 0.48 : 0.36);
    const bw = (gw / veri.length) * 0.62;
    const pts = [];
    veri.forEach((v, k) => {
      const ilerle = Math.max(0, Math.min(1, (t * 0.9 - k * 0.25) % 100));
      const bh = (taban - tepe) * (v / max) * (1 - (1 - ilerle) ** 3);
      const x = gx + (k + 0.19) * (gw / veri.length);
      ctx.fillStyle = k === veri.length - 1 ? '#FFC23A' : '#3A8AFF';
      ctx.fillRect(x, taban - bh, bw, bh);
      pts.push([x + bw / 2, taban - bh - 20]);
    });
    ctx.strokeStyle = '#7CFF5A'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const [ux, uy] = pts.at(-1);
    ctx.fillStyle = '#7CFF5A'; ctx.beginPath(); ctx.moveTo(ux + 30, uy - 30); ctx.lineTo(ux - 8, uy - 26); ctx.lineTo(ux + 26, uy + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#16233A'; ctx.fillRect(0, yer, W, H - yer);
  }
  ctx.restore();
}
