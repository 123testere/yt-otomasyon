// Teknoloji / yapay zekâ haberleri için mekânlar (ölçüden bağımsız).
// sunucu (veri merkezi), yz-lab (dev ekranda canlı sinir ağı), gelecek (uçan araçlı gelecek şehri)
import { h } from './dizi.js';

export const TEKNO_MEKANLAR = ['sunucu', 'yz-lab', 'gelecek'];

const MAVI = '#3EE0FF';
const MOR = '#A86BFF';
const PEMBE = '#FF3EA5';

function zemin(ctx, W, H, y, renk, cizgi) {
  ctx.fillStyle = renk; ctx.fillRect(0, y, W, H - y);
  ctx.strokeStyle = cizgi; ctx.lineWidth = 2;
  for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * W * 0.04, y); ctx.lineTo(W / 2 + k * W * 0.2, H); ctx.stroke(); }
  for (let k = 1; k < 7; k++) { const yy = y + (H - y) * (k / 7) ** 1.7; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
}

function rack(ctx, x, y, w, hh, t, seed) {
  ctx.fillStyle = '#0E141E'; ctx.fillRect(x, y - hh, w, hh);
  ctx.strokeStyle = '#2A3A50'; ctx.lineWidth = 4; ctx.strokeRect(x, y - hh, w, hh);
  const n = 9;
  for (let k = 0; k < n; k++) {
    const yy = y - hh + 12 + k * ((hh - 24) / n);
    ctx.fillStyle = '#18202E'; ctx.fillRect(x + 8, yy, w - 16, (hh - 24) / n - 6);
    for (let l = 0; l < 4; l++) {
      const yan = Math.sin(t * (3 + h(k + l + seed) * 9) + k * 3 + l + seed) > 0.2;
      ctx.fillStyle = yan ? (l === 0 ? '#7CFF5A' : MAVI) : '#14303A';
      ctx.fillRect(x + w - 24 - l * 13, yy + 6, 8, 6);
    }
  }
}

// Sinir ağı: katmanlar arası bağlantılarda akan ışık noktaları
function sinirAgi(ctx, x, y, w, hh, t) {
  const katman = [3, 5, 5, 3];
  const noktalar = katman.map((n, i) => Array.from({ length: n }, (_, k) => [x + (w * (i + 0.5)) / katman.length, y + (hh * (k + 0.5)) / n]));
  for (let i = 0; i < noktalar.length - 1; i++) {
    for (const [ax, ay] of noktalar[i]) for (const [bx, by] of noktalar[i + 1]) {
      ctx.strokeStyle = 'rgba(62,224,255,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const p = (t * 0.8 + h(ax * 0.01 + by * 0.013)) % 1;
      ctx.fillStyle = 'rgba(168,107,255,.9)'; ctx.beginPath(); ctx.arc(ax + (bx - ax) * p, ay + (by - ay) * p, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  noktalar.flat().forEach(([nx, ny], k) => {
    const parla = 0.5 + 0.5 * Math.sin(t * 4 + k);
    ctx.fillStyle = `rgba(62,224,255,${0.4 + parla * 0.6})`; ctx.shadowColor = MAVI; ctx.shadowBlur = 16 * parla;
    ctx.beginPath(); ctx.arc(nx, ny, Math.min(w, hh) * 0.035, 0, Math.PI * 2); ctx.fill();
  });
  ctx.shadowBlur = 0;
}

export function teknoMekan(ctx, ad, o = {}) {
  const { W = 1920, H = 1080, t = 0, kamera = 0 } = o;
  const dikey = H > W;
  const yer = H * (dikey ? 0.7 : 0.72);
  ctx.save();
  const z = 1 + Math.min(1, kamera) * 0.05;
  ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.55);

  if (ad === 'sunucu') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060A12'); g.addColorStop(1, '#0C1626');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rw = dikey ? W * 0.2 : W * 0.09;
    const n = Math.ceil(W / (rw * 1.15));
    for (let k = 0; k < n; k++) rack(ctx, k * rw * 1.15 + rw * 0.08, yer, rw, (yer - H * 0.08) * (0.92 + h(k) * 0.06), t, k);
    // Soğuk mavi ışık şeridi
    ctx.fillStyle = 'rgba(62,224,255,.1)'; ctx.fillRect(0, H * 0.05, W, 6);
    zemin(ctx, W, H, yer, '#0A101A', 'rgba(62,224,255,.12)');
  } else if (ad === 'yz-lab') {
    ctx.fillStyle = '#080812'; ctx.fillRect(0, 0, W, H);
    const sw = dikey ? W * 0.86 : W * 0.62;
    const sh = dikey ? H * 0.28 : H * 0.5;
    const sx = (W - sw) / 2;
    const sy = dikey ? H * 0.37 : H * 0.12;
    ctx.fillStyle = '#0A1430'; ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#2A3A6A'; ctx.lineWidth = 12; ctx.strokeRect(sx, sy, sw, sh);
    sinirAgi(ctx, sx + sw * 0.06, sy + sh * 0.1, sw * 0.88, sh * 0.8, t);
    const g = ctx.createRadialGradient(W / 2, sy + sh / 2, 20, W / 2, sy + sh / 2, sw);
    g.addColorStop(0, 'rgba(62,224,255,.12)'); g.addColorStop(1, 'rgba(62,224,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    zemin(ctx, W, H, yer, '#0C0C1C', 'rgba(168,107,255,.14)');
  } else if (ad === 'gelecek') {
    const g = ctx.createLinearGradient(0, 0, 0, yer);
    g.addColorStop(0, '#0A0626'); g.addColorStop(0.6, '#3A1450'); g.addColorStop(1, '#B83A6A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 60; k++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.4 * h(k * 7)})`; ctx.fillRect(h(k) * W, h(k * 3) * H * 0.4, 2, 2); }
    // Gökdelenler ve pencere ışıkları
    const n = dikey ? 9 : 18;
    for (let k = 0; k < n; k++) {
      const bw = (W / n) * (0.7 + h(k) * 0.25);
      const bx = (k * W) / n;
      const bh = (yer - H * 0.2) * (0.35 + h(k * 5) * 0.65);
      ctx.fillStyle = k % 2 ? '#140C2A' : '#1C1238'; ctx.fillRect(bx, yer - bh, bw, bh);
      ctx.fillStyle = [MAVI, MOR, PEMBE][k % 3]; ctx.globalAlpha = 0.8; ctx.fillRect(bx, yer - bh, bw, 4); ctx.globalAlpha = 1;
      for (let p = 0; p < bh / 26; p++) for (let q = 0; q < bw / 22; q++) if (h(k * 97 + p * 13 + q) > 0.6) {
        ctx.fillStyle = 'rgba(255,230,160,.55)'; ctx.fillRect(bx + 6 + q * 22, yer - bh + 14 + p * 26, 9, 12);
      }
    }
    // Uçan araçlar / dronlar
    for (let k = 0; k < 5; k++) {
      const x = ((t * (60 + k * 25) + h(k) * W) % (W + 200)) - 100;
      const y = H * (0.12 + k * 0.06) + Math.sin(t * 2 + k) * 10;
      ctx.fillStyle = '#E8E8F0'; ctx.beginPath(); ctx.ellipse(x, y, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Math.sin(t * 8 + k) > 0 ? PEMBE : MAVI; ctx.beginPath(); ctx.arc(x - 20, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    zemin(ctx, W, H, yer, '#120A20', 'rgba(255,62,165,.16)');
  }
  ctx.restore();
}
