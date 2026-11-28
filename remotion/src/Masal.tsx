// Dodi masal motoru (uzun 1920x1080, Shorts 1080x1920): işteki hikâye JSON'unu sahne sahne çizer; söylenen her şey o kelimede belirir.
// Kaynak: engine/src/pipeline/build-masal.js props gönderir. Senaryo şeması: routine/bolumler/masal.md
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

type Wd = { w: string; t: number; d: number; s: number };
type Veri = { dil: string; sure: number; sahne: { t0: number; t1: number }[]; words: Wd[] };
type C = CanvasRenderingContext2D;
const W = 1920, H = 1080, FONT = "'Segoe UI Rounded', 'Arial Rounded MT Bold', 'Segoe UI', Arial, sans-serif";
const M = '#3b2a4a';
const cl = (v: number) => Math.min(1, Math.max(0, v));
const pr = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const eo = (x: number) => 1 - Math.pow(1 - cl(x), 3);
const zip = (x: number) => { x = cl(x); return x < 0.6 ? eo(x / 0.6) * 1.15 : 1.15 - 0.15 * eo((x - 0.6) / 0.4); };
const sade = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
let DIL = 'en', TT = 0;

// ---------- temel çizim ----------
function el(c: C, x: number, y: number, rx: number, ry: number, fill: any, cz = 0, renk = M) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (cz) { c.lineWidth = cz; c.strokeStyle = renk; c.stroke(); }
}
function rr(c: C, x: number, y: number, w: number, h: number, r: number, fill: string, cz = 0) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (cz) { c.lineWidth = cz; c.strokeStyle = M; c.stroke(); }
}
function yazi(c: C, s: string, x: number, y: number, boy: number, renk = '#fff', a = 1, kontur = M) {
  if (a <= 0) return; c.save(); c.globalAlpha *= a; c.font = `900 ${boy}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = boy * 0.18; c.strokeStyle = kontur; c.strokeText(s, x, y); c.fillStyle = renk; c.fillText(s, x, y); c.restore();
}
function yuz(c: C, x: number, y: number, s: number, ifade: string, t: number, bak = 0) {
  if (ifade === 'ufle') ifade = 'sasir';
  const kirp = ifade === 'uyku' ? 1 : (Math.sin(t * 1.7 + x * 0.01) > 0.985 ? 1 : 0);
  for (const dx of [-1, 1]) {
    const gx = x + dx * 26 * s + bak * 6 * s, gy = y;
    if (kirp) { c.lineWidth = 6 * s; c.strokeStyle = M; c.lineCap = 'round'; c.beginPath(); c.arc(gx, gy, 11 * s, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); continue; }
    el(c, gx, gy, 15 * s, (ifade === 'sasir' ? 19 : 17) * s, '#fff');
    el(c, gx + bak * 4 * s, gy + 2 * s, 9 * s, 10 * s, M);
    el(c, gx + bak * 4 * s - 3 * s, gy - 2 * s, 3.5 * s, 3.5 * s, '#fff');
    if (ifade === 'uzgun') { c.lineWidth = 5 * s; c.strokeStyle = M; c.beginPath(); c.moveTo(gx - 14 * s, gy - 25 * s - dx * 7 * s); c.lineTo(gx + 14 * s, gy - 25 * s + dx * 7 * s); c.stroke(); }
  }
  el(c, x - 46 * s, y + 26 * s, 12 * s, 7 * s, 'rgba(255,120,150,.45)'); el(c, x + 46 * s, y + 26 * s, 12 * s, 7 * s, 'rgba(255,120,150,.45)');
  c.lineWidth = 6 * s; c.strokeStyle = M; c.lineCap = 'round'; c.beginPath();
  if (ifade === 'mutlu') c.arc(x, y + 22 * s, 16 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (ifade === 'uzgun') c.arc(x, y + 42 * s, 13 * s, 1.2 * Math.PI, 1.8 * Math.PI);
  else if (ifade === 'sasir') c.ellipse(x, y + 34 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2);
  else if (ifade === 'uyku') c.arc(x, y + 28 * s, 7 * s, 0.1 * Math.PI, 0.9 * Math.PI);
  else { c.moveTo(x - 10 * s, y + 30 * s); c.lineTo(x + 10 * s, y + 28 * s); }
  c.stroke();
}
function gozyasi(c: C, x: number, y: number, s: number, t: number) {
  for (const [dx, k] of [[-30, 0], [30, 0.5]]) { const p = (t * 0.9 + k) % 1; c.save(); c.globalAlpha *= 1 - p; el(c, x + dx * s, y + 20 * s + p * 90 * s, 7 * s, 11 * s, '#7cc8ff'); c.restore(); }
}
function kalp(c: C, x: number, y: number, s: number, a = 1) {
  if (a <= 0) return; c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s); c.beginPath(); c.moveTo(0, 18);
  c.bezierCurveTo(-40, -10, -18, -42, 0, -18); c.bezierCurveTo(18, -42, 40, -10, 0, 18); c.fillStyle = '#ff5c8a'; c.fill(); c.lineWidth = 3; c.strokeStyle = M; c.stroke(); c.restore();
}
function yildiz4(c: C, x: number, y: number, r: number, renk = '#fff6b0') {
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fillStyle = renk; c.fill();
}
function bulut(c: C, x: number, y: number, s: number, renk = '#fff', yuzlu = '', t = 0, kontur = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const P = [[-110, 20, 70], [-40, -30, 95], [60, -10, 85], [130, 30, 60], [0, 40, 80]];
  if (kontur) for (const [dx, dy, r] of P) el(c, dx, dy, r + 4, r * 0.85 + 4, M);
  for (const [dx, dy, r] of P) el(c, dx, dy, r, r * 0.85, renk);
  if (yuzlu) yuz(c, 10, 10, 1, yuzlu, t);
  c.restore();
}
function rengiKaristir(a: string, b: string, p: number) {
  const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = h(a), B = h(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
}

// ---------- karakterler ----------
type O = { x: number; y: number; s: number; t: number; i: string; yon: number; don: number; bak: number; o: any; u: number; ap: (k: any, d?: number) => number };
const KAR: Record<string, (c: C, o: O) => void> = {
  pitpit(c, o) {
    c.translate(o.x, o.y); c.rotate(o.don); c.scale(o.s, o.s);
    const g = c.createLinearGradient(-90, -150, 90, 90); g.addColorStop(0, '#9fe0ff'); g.addColorStop(1, '#3a9be8');
    c.beginPath(); c.moveTo(0, -170); c.bezierCurveTo(30, -110, 100, -40, 95, 20); c.bezierCurveTo(90, 85, 45, 110, 0, 110); c.bezierCurveTo(-45, 110, -90, 85, -95, 20); c.bezierCurveTo(-100, -40, -30, -110, 0, -170);
    c.fillStyle = g; c.fill(); c.lineWidth = 8; c.strokeStyle = M; c.stroke();
    el(c, -40, -40, 16, 30, 'rgba(255,255,255,.65)');
    yuz(c, 0, 20, 1, o.i, o.t, o.bak);
  },
  anne(c, o) {
    const gri = typeof o.o.gri === 'number' ? o.o.gri : o.o.gri ? o.ap(o.o.gri, 1.5) : 0;
    const sar = o.o.sar ? Math.sin(pr(o.u, o.ap.length ? 0 : 0, 1) * 0) : 0; void sar;
    bulut(c, o.x, o.y, o.s, rengiKaristir('#ffffff', '#9aa4b8', gri), o.i, o.t, 0);
  },
  lale(c, o) {
    c.translate(o.x, o.y); c.scale(o.s * o.yon, o.s);
    c.lineWidth = 6; c.strokeStyle = M; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const sal = Math.sin(o.t * 10 + k) * 6; c.beginPath(); c.moveTo(-40 + k * 40, 50); c.lineTo(-50 + k * 40 + sal, 90); c.stroke(); }
    el(c, 0, 0, 100, 72, '#e8312f', 7);
    c.beginPath(); c.moveTo(60, -60); c.quadraticCurveTo(-10, -10, -95, 10); c.stroke();
    for (const [dx, dy, r] of [[-55, -30, 14], [-20, 25, 15], [-65, 30, 11], [20, -40, 13], [25, 30, 13], [-15, -50, 10], [55, -5, 12]]) el(c, dx, dy, r, r, '#2b2233');
    el(c, 0, -25, 30, 12, 'rgba(255,255,255,.35)');
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(105, -30); c.quadraticCurveTo(125 + k * 8, -90, 140 + k * 18, -95); c.stroke(); el(c, 140 + k * 18, -95, 9, 9, '#2b2233'); }
    el(c, 100, 5, 50, 46, '#2b2233', 6);
    yuz(c, 108, 0, 0.62, o.i, o.t, 0.6);
  },
  balik(c, o) {
    c.translate(o.x, o.y); c.scale(o.s * o.yon, o.s);
    const kuy = Math.sin(o.t * 8) * 0.35;
    c.save(); c.translate(-80, 0); c.rotate(kuy); c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, -50); c.quadraticCurveTo(-55, 0, -70, 50); c.closePath(); c.fillStyle = '#ff7a2e'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke(); c.restore();
    c.beginPath(); c.moveTo(-20, -50); c.quadraticCurveTo(10, -95, 40, -52); c.fillStyle = '#ff7a2e'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke();
    el(c, 0, 0, 95, 60, '#ffa040', 7);
    c.lineWidth = 10; c.strokeStyle = '#fff'; for (const x of [-35, 0]) { c.beginPath(); c.moveTo(x, -55); c.quadraticCurveTo(x + 12, 0, x, 55); c.stroke(); }
    yuz(c, 50, -8, 0.62, o.i, o.t, 0.5);
  },
  kurbaga(c, o) {
    c.translate(o.x, o.y); c.scale(o.s * o.yon, o.s);
    for (const k of [-1, 1]) el(c, k * 85, 75, 45, 20, '#4aa85a', 6);
    el(c, 0, 20, 100, 72, '#5cc46a', 7); el(c, 0, 45, 62, 38, '#c9f2b0');
    for (const k of [-1, 1]) el(c, k * 34, -38, 34, 32, '#5cc46a', 7);
    el(c, 0, 0, 70, 30, '#5cc46a');
    yuz(c, 0, -38, 1.3, o.i, o.t, o.bak);
  },
  salyangoz(c, o) {
    c.translate(o.x, o.y); c.scale(o.s * o.yon, o.s);
    const uyku = o.i === 'uyku';
    c.beginPath(); c.moveTo(-120, 40); c.quadraticCurveTo(0, 55, uyku ? 70 : 120, 40); c.lineTo(uyku ? 70 : 125, 10); c.quadraticCurveTo(0, 20, -120, 40); c.fillStyle = '#f3d7a6'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke();
    if (!uyku) {
      c.lineWidth = 5; for (const [ex, ey] of [[100, -95], [135, -85]]) { c.beginPath(); c.moveTo(115, -20); c.lineTo(ex + Math.sin(o.t * 2) * 4, ey); c.stroke(); el(c, ex + Math.sin(o.t * 2) * 4, ey, 9, 9, M); }
      el(c, 115, -5, 40, 42, '#f3d7a6', 6); yuz(c, 118, 0, 0.5, o.i, o.t, 0.5);
    }
    el(c, -10, -45, 82, 78, '#e8a35a', 7);
    c.lineWidth = 7; c.strokeStyle = '#b8742f'; c.beginPath(); for (let a = 0; a < 5.5 * Math.PI; a += 0.2) { const r = 6 + a * 3.9; c.lineTo(-10 + Math.cos(a) * r, -45 + Math.sin(a) * r * 0.95); } c.stroke();
  },
  gunes(c, o) {
    c.translate(o.x, o.y); c.scale(o.s, o.s);
    const g = c.createRadialGradient(0, 0, 60, 0, 0, 320); g.addColorStop(0, 'rgba(255,220,90,.45)'); g.addColorStop(1, 'rgba(255,220,90,0)'); c.fillStyle = g; c.fillRect(-330, -330, 660, 660);
    c.save(); c.rotate(o.t * 0.3); for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); rr(c, 125, -13, 75, 26, 13, '#ffc83d'); } c.restore();
    el(c, 0, 0, 115, 115, '#ffd84d', 7); yuz(c, 0, 0, 1.15, o.i, o.t);
  },
  ruzgar(c, o) {
    c.translate(o.x, o.y); c.scale(o.s, o.s);
    bulut(c, 0, 0, 0.9, '#dff1ff', '', o.t);
    el(c, -40, 30, 26, 22, 'rgba(255,140,170,.5)'); el(c, 70, 30, 26, 22, 'rgba(255,140,170,.5)');
    yuz(c, 15, 0, 1, o.i, o.t, 0.8);
    c.lineWidth = 9; c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const p = (o.t * 1.2 + i / 3) % 1; c.save(); c.globalAlpha *= 1 - p; c.beginPath(); const x0 = 140 + p * 300, y0 = -20 + i * 40; c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 60, y0 - 25, x0 + 120, y0); c.stroke(); c.restore(); }
  },
  fener(c, o) {
    let isik = 1; const v = o.o.isik;
    if (typeof v === 'number') isik = v; else if (Array.isArray(v)) isik = lerp(v[0], v[1], o.ap(v[2], 2.5));
    if (o.o.yanson) isik *= Math.sin(o.t * 4) > -0.2 ? 1 : 0.2;
    c.translate(o.x, o.y); c.scale(o.s, o.s);
    if (isik > 0) { const g = c.createRadialGradient(0, 40, 0, 0, 40, 380 * isik); g.addColorStop(0, `rgba(255,236,120,${Math.min(0.8, 0.6 * isik)})`); g.addColorStop(1, 'rgba(255,236,120,0)'); c.fillStyle = g; c.fillRect(-900, -900, 1800, 1800); }
    const kanat = Math.sin(o.t * 22) * 0.35;
    for (const dx of [-1, 1]) { c.save(); c.rotate(dx * (0.5 + kanat)); el(c, dx * 70, -60, 60, 34, 'rgba(220,240,255,.75)', 4); c.restore(); }
    el(c, 0, 0, 80, 72, '#5b4a8a', 7); el(c, 0, 90, 58, 50, isik > 0.15 ? '#fff27a' : '#a89a40', 7);
    c.lineWidth = 5; c.strokeStyle = M; for (const dx of [-1, 1]) { c.beginPath(); c.moveTo(dx * 20, -66); c.quadraticCurveTo(dx * 40, -130, dx * 64, -136); c.stroke(); el(c, dx * 66, -138, 10, 10, '#fff27a', 3); }
    yuz(c, 0, -6, 0.85, o.i, o.t);
  },
  kartane(c, o) {
    const kol = o.o.kol ? o.ap(o.o.kol, 1.2) : 1; c.translate(o.x, o.y); c.rotate(o.don + o.t * 0.4); c.scale(o.s, o.s);
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 220); g.addColorStop(0, 'rgba(220,245,255,.6)'); g.addColorStop(1, 'rgba(220,245,255,0)'); c.fillStyle = g; c.fillRect(-230, -230, 460, 460);
    c.lineCap = 'round'; for (let j = 0; j < 6; j++) { const q = cl(kol * 6 - j); if (q <= 0) continue; c.save(); c.rotate(j * Math.PI / 3); const L = 170 * eo(q);
      c.lineWidth = 26; c.strokeStyle = M; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -L); c.stroke(); c.lineWidth = 16; c.strokeStyle = '#bfeaff'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -L); c.stroke();
      if (q > 0.6) for (const d of [-1, 1]) { c.lineWidth = 12; c.strokeStyle = '#bfeaff'; c.beginPath(); c.moveTo(0, -L * 0.6); c.lineTo(d * 45, -L * 0.6 - 45); c.stroke(); } c.restore(); }
    c.rotate(-(o.don + o.t * 0.4)); el(c, 0, 0, 78, 78, '#e3f6ff', 7); yuz(c, 0, 0, 0.9, o.i, o.t);
  },
  baykus(c, o) {
    c.translate(o.x, o.y); c.scale(o.s, o.s);
    rr(c, -160, 85, 320, 26, 13, '#6b4a2f', 5);
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * 30, -70); c.lineTo(k * 60, -115); c.lineTo(k * 62, -55); c.closePath(); c.fillStyle = '#8a6a4a'; c.fill(); c.lineWidth = 5; c.strokeStyle = M; c.stroke(); }
    el(c, 0, 0, 70, 88, '#8a6a4a', 6); el(c, 0, 30, 45, 50, '#d9c3a0');
    for (const k of [-1, 1]) el(c, k * 28, -28, 26, 26, '#f4e7c8', 4);
    yuz(c, 0, -28, 1.05, o.i, o.t);
    c.beginPath(); c.moveTo(-8, -4); c.lineTo(8, -4); c.lineTo(0, 12); c.closePath(); c.fillStyle = '#ffb02e'; c.fill();
  },
};

// ---------- mekânlar ----------
const GOK: Record<string, [string, string]> = { gun: ['#7cc8ff', '#e3f6ff'], aksam: ['#ff8a65', '#ffd59e'], gece: ['#0b1a3a', '#28396e'], safak: ['#ffb88a', '#fff0c8'] };
const ALT: Record<string, string> = { gun: '', aksam: 'rgba(255,110,60,.16)', gece: 'rgba(8,15,48,.58)', safak: 'rgba(255,170,90,.12)' };
function gokyuzu(c: C, z: string, t: number) {
  const [a, b] = GOK[z] ?? GOK.gun; const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (z === 'gece') { for (let i = 0; i < 90; i++) { const x = (i * 211) % W, y = (i * 137) % 640; c.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.1 + i)); el(c, x, y, 2.6, 2.6, '#fff'); } c.globalAlpha = 1; el(c, 1650, 170, 70, 70, '#fff6c8'); el(c, 1685, 148, 62, 62, a); }
  const bc = z === 'gece' ? 'rgba(200,210,255,.18)' : z === 'aksam' ? 'rgba(255,230,220,.85)' : '#ffffff';
  for (const [x0, y, s, v] of [[200, 130, 0.6, 8], [800, 90, 0.45, 5], [1350, 160, 0.55, 7], [1800, 80, 0.4, 4]]) { const x = ((x0 + t * v) % (W + 400)) - 200; bulut(c, x, y, s, bc); }
}
function cicekler(c: C, y0: number, n = 110) {
  for (let i = 0; i < n; i++) { const x = (i * 173.3) % W, y = y0 + ((i * 97) % (H - y0)); const k = ['#ff8fb0', '#ffd84d', '#ffffff', '#c9a2ff', '#ff6b6b'][i % 5]; for (let p = 0; p < 5; p++) el(c, x + Math.cos(p * 1.26) * 9, y + Math.sin(p * 1.26) * 9, 7, 7, k); el(c, x, y, 5, 5, '#ffb02e'); }
}
function agac(c: C, x: number, y: number, s: number) {
  rr(c, x - 16 * s, y - 30 * s, 32 * s, 150 * s, 12, '#8a5a3a', 5);
  for (const [dx, dy, r] of [[0, -110, 90], [-65, -60, 70], [65, -60, 70], [0, -40, 70]]) el(c, x + dx * s, y + dy * s, r * s, r * s, '#4fae4a', 5);
  for (const [dx, dy] of [[-30, -130], [40, -90], [-60, -50], [20, -40]]) el(c, x + dx * s, y + dy * s, 13 * s, 12 * s, '#ff6b6b', 3);
}
function canlilar(c: C, z: string) {
  if (z === 'gece') return;
  for (let i = 0; i < 3; i++) { const x = 150 + ((TT * 55 + i * 600) % 1700), y = 560 + Math.sin(TT * 2 + i) * 70, k = Math.abs(Math.sin(TT * 12 + i)); c.save(); c.translate(x, y); for (const d of [-1, 1]) el(c, d * 16 * k, -6, 16 * k + 2, 20, ['#ff8fb0', '#c9a2ff', '#ffd84d'][i], 3); rr(c, -3, -18, 6, 30, 3, M); c.restore(); }
  c.lineWidth = 5; c.strokeStyle = M; for (let i = 0; i < 3; i++) { const x = ((TT * 80 + i * 500) % 2200) - 150, y = 260 + i * 45 + Math.sin(TT * 3 + i) * 10, k = Math.sin(TT * 10 + i) * 10; c.beginPath(); c.moveTo(x - 22, y - k); c.quadraticCurveTo(x - 10, y - 14, x, y); c.quadraticCurveTo(x + 10, y - 14, x + 22, y - k); c.stroke(); }
}
function cayir(c: C, z: string) {
  el(c, 350, 860, 900, 300, '#8fd97a'); el(c, 1550, 880, 950, 320, '#74c763');
  c.fillStyle = '#64b956'; c.fillRect(0, 900, W, H - 900);
  agac(c, 130, 690, 1); agac(c, 1790, 680, 1.1); agac(c, 1620, 720, 0.7);
  cicekler(c, 760); canlilar(c, z);
}
function yaprak(c: C, x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(-0.06);
  c.beginPath(); c.moveTo(-260, 0); c.quadraticCurveTo(0, -120, 260, 0); c.quadraticCurveTo(0, 90, -260, 0); c.fillStyle = '#5cbf4c'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke();
  c.beginPath(); c.moveTo(-240, 0); c.lineTo(240, -4); c.stroke(); for (const k of [-150, -50, 50, 150]) { c.beginPath(); c.moveTo(k, -2); c.lineTo(k + 50, -40); c.stroke(); c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 50, 32); c.stroke(); }
  c.beginPath(); c.moveTo(260, 0); c.quadraticCurveTo(320, 40, 330, 140); c.lineWidth = 12; c.stroke(); c.restore();
}
function dere(c: C, z: string, sc: any, u: number, ap: (k: any, d?: number) => number) {
  cayir(c, z);
  const gen = 1 + 0.6 * (sc.genis ? ap(sc.genis, 3) : 0), hiz = sc.akis ?? 0.6, yc = 850;
  const ust = (x: number) => yc - 60 * gen + Math.sin(x / 260) * 18, alt = (x: number) => yc + 55 * gen + Math.sin(x / 260 + 1) * 18;
  c.beginPath(); c.moveTo(0, ust(0)); for (let x = 0; x <= W; x += 40) c.lineTo(x, ust(x)); for (let x = W; x >= 0; x -= 40) c.lineTo(x, alt(x)); c.closePath();
  c.fillStyle = '#5ab8f0'; c.fill(); c.lineWidth = 7; c.strokeStyle = M; c.stroke();
  c.lineWidth = 5; c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const x = ((i * 157 + TT * 160 * hiz) % (W + 200)) - 100, y = yc - 30 * gen + (i % 4) * 22 * gen; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 25, y - 10, x + 50, y); c.stroke(); }
  for (let i = 0; i < 6; i++) { const x = ((i * 380 + TT * 160 * hiz * (sc.akis ? 1 : 0)) % (W + 300)) - 150; el(c, x, ust(x) - 6, 40, 22, '#a9a2b5', 5); el(c, x + 190, alt(x + 190) + 8, 34, 20, '#bdb6c8', 5); }
}
function gol(c: C, z: string) {
  el(c, 350, 860, 900, 300, '#8fd97a'); el(c, 1550, 880, 950, 320, '#74c763'); c.fillStyle = '#64b956'; c.fillRect(0, 900, W, H - 900);
  agac(c, 130, 690, 1); agac(c, 1790, 680, 1.1);
  cicekler(c, 1000, 30);
  el(c, 960, 900, 880, 175, '#4aa8e0', 7);
  c.save(); c.beginPath(); c.ellipse(960, 900, 876, 171, 0, 0, Math.PI * 2); c.clip();
  c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 10; i++) { const x = 250 + i * 150 + Math.sin(TT + i) * 20, y = 830 + (i % 3) * 50; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 60, y); c.stroke(); } c.restore();
  for (const [x, y, r, ci] of [[560, 900, 85, 1], [960, 880, 125, 0], [1350, 890, 100, 1], [1620, 950, 65, 0], [330, 960, 70, 0]] as const) {
    c.beginPath(); c.ellipse(x, y, r, r * 0.33, 0, 0.2, Math.PI * 2 - 0.1); c.lineTo(x, y); c.closePath(); c.fillStyle = '#58b84a'; c.fill(); c.lineWidth = 5; c.strokeStyle = M; c.stroke();
    if (ci) { for (let p = 0; p < 6; p++) el(c, x + Math.cos(p) * 16, y - 14 + Math.sin(p) * 8, 12, 9, '#ffb6d0', 3); el(c, x, y - 16, 8, 6, '#ffd84d'); }
  }
  c.lineWidth = 7; c.strokeStyle = '#3f8f45'; for (const bx of [80, 120, 160, 1760, 1810, 1850]) { const sal = Math.sin(TT * 1.5 + bx) * 10; c.beginPath(); c.moveTo(bx, 1000); c.quadraticCurveTo(bx + sal, 860, bx + sal * 2, 760); c.stroke(); el(c, bx + sal * 2, 790, 10, 30, '#8a5a3a', 3); }
  canlilar(c, z);
}
function kis(c: C) {
  c.fillStyle = 'rgba(220,235,250,.55)'; c.fillRect(0, 0, W, H);
  el(c, 350, 860, 900, 300, '#f4f9ff', 5); el(c, 1550, 880, 950, 320, '#e8f2fc', 5); c.fillStyle = '#e8f2fc'; c.fillRect(0, 900, W, H - 900);
  for (const [x, y, sc] of [[130, 700, 1], [1790, 690, 1.1], [600, 740, 0.7], [1330, 740, 0.75]]) { rr(c, x - 14 * sc, y - 20 * sc, 28 * sc, 120 * sc, 10, '#8a5a3a', 5);
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y - (230 - k * 60) * sc); c.lineTo(x - (70 + k * 25) * sc, y - (120 - k * 60) * sc); c.lineTo(x + (70 + k * 25) * sc, y - (120 - k * 60) * sc); c.closePath(); c.fillStyle = '#3f8f5a'; c.fill(); c.lineWidth = 5; c.strokeStyle = M; c.stroke(); el(c, x, y - (215 - k * 60) * sc, 40 * sc, 14 * sc, '#fff'); } }
}
function gokMekan(c: C) { el(c, 500, 1250, 1100, 260, '#8fd97a'); el(c, 1500, 1270, 1100, 270, '#74c763'); }
function zemin(c: C, sc: any, z: string, u: number, t: number, ap: (k: any, d?: number) => number) {
  gokyuzu(c, z, t);
  if (sc.m === 'cayir') cayir(c, z);
  else if (sc.m === 'yaprak') { cayir(c, z); yaprak(c, 960, 800, 1.6); }
  else if (sc.m === 'dere') dere(c, z, sc, u, ap);
  else if (sc.m === 'gol') gol(c, z);
  else if (sc.m === 'kis') kis(c);
  else gokMekan(c);
  if (ALT[z]) { c.fillStyle = ALT[z]; c.fillRect(0, z === 'gece' ? 640 : 0, W, H); if (z === 'gece') { c.fillStyle = 'rgba(8,15,48,.25)'; c.fillRect(0, 0, W, 640); } }
  if (sc.kara) { c.fillStyle = `rgba(0,0,20,${sc.kara})`; c.fillRect(0, 0, W, H); }
}

// ---------- nesneler ----------
function nesne(c: C, n: any, u: number, t: number, ap: (k: any, d?: number) => number, w: (k: string) => number) {
  let a = n.at ? ap(n.at, 0.5) : 1; if (n.bitir) a *= 1 - ap(n.bitir, 0.4); if (a <= 0) return;
  const s = n.s ?? 1, x = n.x, y = n.y, yer = (n.at ? u - w(n.at) : u);
  const metin = n[DIL] ?? n.en ?? '';
  c.save();
  switch (n.k) {
    case 'soru': [[-170, 30, 120, 0], [170, -10, 150, 1.3], [0, -90, 95, 2.1]].forEach(([dx, dy, b, k]) => yazi(c, '?', x + dx, y + dy + Math.sin(t * 3 + k) * 14, b * zip(a), '#ffd23e', a)); break;
    case 'isim': { const z = zip(a); c.translate(x, y); c.scale(z, z); c.font = `900 60px ${FONT}`; const ww = c.measureText(metin).width + 80; rr(c, -ww / 2, -45, ww, 90, 45, '#ff6b9a', 6); yazi(c, metin, 0, 2, 60, '#fff'); break; }
    case 'baslik': { const b = a * (1 - pr(yer, 6, 7)); if (b <= 0) break; c.globalAlpha = b; const z = zip(a); c.translate(W / 2, 170); c.scale(z, z); const ttl = HIK_BASLIK[DIL]; c.font = `900 92px ${FONT}`; const ww = c.measureText(ttl).width + 120; rr(c, -ww / 2, -80, ww, 160, 80, 'rgba(255,255,255,.95)', 7); yazi(c, ttl, 0, 4, 92, '#ff6b9a', 1, '#fff'); break; }
    case 'kalp': kalp(c, x, y - eo(a) * 30 + Math.sin(t * 3 + x) * 8, 2 * s * zip(a), a); break;
    case 'nota': for (let i = 0; i < 4; i++) { const p = (t * 0.45 + i / 4) % 1; yazi(c, i % 2 ? '♫' : '♪', x + Math.sin(p * 6 + i) * 50 + i * 30, y - p * 220, 64, ['#ff6b9a', '#3a9be8', '#ffb02e', '#8a5cd6'][i], a * (1 - p) * Math.min(1, p * 5)); } break;
    case 'etiket': { const b = n.buyuk ? 130 : 60; c.save(); c.translate(x, y); const z = zip(a); c.scale(z, z); yazi(c, metin, 0, 0, b, '#fff', a); c.restore(); break; }
    case 'parilti': for (let i = 0; i < 9; i++) { const ang = i * 0.7 + t * 0.4, r = 70 + (i % 3) * 45, k = Math.abs(Math.sin(t * 3 + i * 1.7)); c.globalAlpha = a * k; yildiz4(c, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.8, (14 + (i % 3) * 8) * zip(a)); } break;
    case 'ses': { const yon = n.yon ?? 1; for (let i = 0; i < 3; i++) { const p = (t * 1.4 + i / 3) % 1; c.globalAlpha = a * (1 - p); c.lineWidth = 9; c.strokeStyle = '#ffd23e'; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, 30 + p * 110, yon > 0 ? -0.6 : Math.PI - 0.6, yon > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); } break; }
    case 'ok': { const p = eo(a); const x2 = lerp(x, n.x2, p), y2 = lerp(y, n.y2, p); c.setLineDash([24, 18]); c.lineDashOffset = -t * 40; c.lineWidth = 12; c.strokeStyle = '#ff6b9a'; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]);
      const an = Math.atan2(n.y2 - y, n.x2 - x); c.translate(x2, y2); c.rotate(an); c.beginPath(); c.moveTo(20, 0); c.lineTo(-30, -28); c.lineTo(-30, 28); c.closePath(); c.fillStyle = '#ff6b9a'; c.fill(); break; }
    case 'ampul': { const z = zip(a); c.translate(x, y + Math.sin(t * 3) * 8); c.scale(z, z); const g = c.createRadialGradient(0, 0, 10, 0, 0, 160); g.addColorStop(0, 'rgba(255,240,120,.8)'); g.addColorStop(1, 'rgba(255,240,120,0)'); c.fillStyle = g; c.fillRect(-170, -170, 340, 340);
      el(c, 0, -10, 55, 60, '#fff27a', 6); rr(c, -26, 40, 52, 40, 8, '#b9b2c4', 5); break; }
    case 'sicrama': { const p = pr(yer, 0, 1.1); if (p >= 1) break; for (let i = 0; i < 9; i++) { const an = -Math.PI * (0.15 + 0.7 * i / 8); const r = 40 + 160 * eo(p); c.globalAlpha = 1 - p; el(c, x + Math.cos(an) * r, y + Math.sin(an) * r * 1.1 + p * p * 120, 11, 15, '#9fe0ff', 3); }
      c.globalAlpha = 1 - p; c.lineWidth = 5; c.strokeStyle = '#fff'; c.beginPath(); c.ellipse(x, y + 20, 60 + 200 * p, 14 + 30 * p, 0, 0, Math.PI * 2); c.stroke(); break; }
    case 'kabarcik': { const k = n.buyuk ? 1.6 : 1; for (let i = 0; i < 7; i++) { const p = (t * 0.6 + i / 7) % 1; c.globalAlpha = a * (1 - p); el(c, x + Math.sin(p * 8 + i) * 25 + (i - 3) * 14, y - p * 200 * k, (8 + (i % 3) * 5) * k, (8 + (i % 3) * 5) * k, 'rgba(220,245,255,.6)', 3, '#ffffff'); } break; }
    case 'bas': for (let i = 0; i < 4; i++) { const an = t * 5 + i * Math.PI / 2; c.globalAlpha = a; yildiz4(c, x + Math.cos(an) * 110, y + Math.sin(an) * 30, 22, '#ffd23e'); } break;
    case 'ucurtma': { const xx = x + Math.sin(t * 0.8) * 60, yy = y + Math.sin(t * 1.3) * 30; c.globalAlpha = a; c.translate(xx, yy); c.rotate(Math.sin(t * 2) * 0.2); c.beginPath(); c.moveTo(0, -80); c.lineTo(55, 0); c.lineTo(0, 90); c.lineTo(-55, 0); c.closePath(); c.fillStyle = '#ff6b9a'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke();
      c.beginPath(); c.moveTo(0, 90); for (let k = 1; k < 8; k++) c.lineTo(Math.sin(t * 5 + k) * 20, 90 + k * 30); c.lineWidth = 4; c.stroke(); break; }
    case 'carpi': { c.translate(x, y); const z = zip(a); c.scale(z, z); yazi(c, metin, 0, 0, 64, '#fff', 1); const p = pr(yer, 0.4, 0.8); c.lineWidth = 16; c.strokeStyle = '#ff3b3b'; c.lineCap = 'round'; c.beginPath(); c.moveTo(-110, -50); c.lineTo(-110 + 220 * p, -50 + 100 * p); c.stroke(); if (p >= 1) { c.beginPath(); c.moveTo(110, -50); c.lineTo(-110, 50); c.stroke(); } break; }
    case 'yusufcuk': { const xx = x + Math.sin(t * 1.4) * 80, yy = y + Math.sin(t * 2.3) * 30; c.globalAlpha = a; c.translate(xx, yy); const k = Math.sin(t * 40) * 0.3; for (const d of [-1, 1]) for (const e of [-1, 1]) { c.save(); c.rotate(d * (0.3 + k) + (e > 0 ? Math.PI : 0)); el(c, 50, 0, 50, 14, 'rgba(200,235,255,.8)', 3); c.restore(); }
      rr(c, -8, -20, 16, 110, 8, '#3a9be8', 4); el(c, 0, -26, 16, 16, '#3a9be8', 4); break; }
    case 'saat': { const z = zip(a); c.translate(x, y); c.scale(z, z); el(c, 0, 0, 90, 90, '#fffaf0', 7); for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6; el(c, Math.cos(an) * 70, Math.sin(an) * 70, 5, 5, M); }
      c.lineWidth = 8; c.strokeStyle = M; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(t * 2 - 1.57) * 62, Math.sin(t * 2 - 1.57) * 62); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(t * 0.2 - 1.57) * 40, Math.sin(t * 0.2 - 1.57) * 40); c.stroke(); break; }
    case 'isik': { const g = c.createRadialGradient(x, y, 20, x, y, 300); g.addColorStop(0, `rgba(255,190,80,${0.55 * a})`); g.addColorStop(1, 'rgba(255,190,80,0)'); c.fillStyle = g; c.fillRect(x - 320, y - 320, 640, 640); break; }
    case 'dusunce': { const z = zip(a); for (const [dx, dy, r] of [[-170, 140, 14], [-130, 100, 22]]) el(c, x + dx, y + dy, r * z, r * z, '#fff', 4); c.translate(x, y); c.scale(z, z); el(c, 0, 0, 150, 100, '#fff', 6); bulut(c, 0, 10, 0.5, '#e8f4ff', 'mutlu', t); break; }
    case 'elmas': { const z = zip(a); c.translate(x, y); c.scale(z, z); c.rotate(Math.sin(t) * 0.1); c.beginPath(); c.moveTo(-60, -20); c.lineTo(-30, -55); c.lineTo(30, -55); c.lineTo(60, -20); c.lineTo(0, 60); c.closePath(); c.fillStyle = '#bfefff'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke(); yildiz4(c, 30, -40, 18); break; }
    case 'isinlar': { const x1 = n.x1, y1 = n.y1; const an = Math.atan2(y - y1, x - x1), L = Math.hypot(x - x1, y - y1); c.translate(x1, y1); c.rotate(an);
      for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; c.globalAlpha = a * 0.35 * (1 - Math.abs(p - 0.5) * 2); c.beginPath(); c.moveTo(0, -20); c.lineTo(L, -90); c.lineTo(L, 90); c.lineTo(0, 20); c.closePath(); c.fillStyle = '#ffd84d'; c.fill(); }
      for (let i = 0; i < 6; i++) { const p = (t * 0.4 + i / 6) % 1; c.globalAlpha = a; yildiz4(c, p * L, Math.sin(i * 3) * 40, 12, '#fff1a0'); } break; }
    case 'tuy': { c.globalAlpha = a; c.translate(x + Math.sin(t * 1.2) * 60, y + Math.sin(t * 0.8) * 30); c.rotate(Math.sin(t * 1.2) * 0.5); c.beginPath(); c.ellipse(0, 0, 25, 85, 0, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 4; c.strokeStyle = M; c.stroke(); c.beginPath(); c.moveTo(0, -85); c.lineTo(0, 110); c.stroke(); break; }
    case 'dongu': { const z = zip(a), R = 230; c.translate(x, y); c.scale(z, z); c.lineWidth = 14; c.strokeStyle = '#3a9be8'; c.lineCap = 'round';
      for (const [a0, a1] of [[-2.6, -0.5], [0.55, 2.6]]) { c.beginPath(); c.arc(0, 0, R, a0, a1); c.stroke(); const ex = Math.cos(a1) * R, ey = Math.sin(a1) * R; c.save(); c.translate(ex, ey); c.rotate(a1 + Math.PI / 2); c.beginPath(); c.moveTo(24, 0); c.lineTo(-18, -24); c.lineTo(-18, 24); c.closePath(); c.fillStyle = '#3a9be8'; c.fill(); c.restore(); }
      bulut(c, 0, -R, 0.45, '#fff', 'mutlu', t, 1); el(c, 0, R - 10, 110, 30, '#4aa8e0', 5);
      for (let i = 0; i < 3; i++) { const p = (t * 0.7 + i / 3) % 1; el(c, -R - 10, -100 + p * 200, 9, 13, '#5ab8f0'); c.globalAlpha = 1 - p; el(c, R + 10, 100 - p * 200, 14, 10, '#ffffff', 3, '#9fd0f0'); c.globalAlpha = 1; }
      gunesMini(c, R + 130, -R + 40, t); break; }
    case 'el': { c.translate(x, y); c.rotate(Math.sin(t * 8) * 0.3); yazi(c, '👋', 0, 0, 150 * zip(a), '#fff', a, 'transparent'); break; }
    case 'zz': for (let i = 0; i < 4; i++) yazi(c, 'z', x + i * 45, y - i * 55 - (t * 30) % 55, 44 + i * 14, '#c9d6ff', a * (0.5 + 0.5 * Math.sin(t * 2 + i))); break;
    case 'ay': el(c, x, y, 95, 95, '#fff6c8', 6); yuz(c, x - 10, y + 5, 0.9, 'uyku', t); break;
    case 'gokkusagi': { const R = n.r ?? 560, p = eo(pr(yer, 0, 2.2)); const REN = ["#ff4d4d","#ff9f1c","#ffd84d","#3ec46d","#3a9be8","#8a5cd6"]; c.globalAlpha = a; c.lineCap = 'butt';
      REN.forEach((k, j) => { c.lineWidth = 42; c.strokeStyle = k; c.beginPath(); c.arc(x, y, R - j * 40, Math.PI, Math.PI + Math.PI * p); c.stroke(); }); break; }
    case 'prizma': { const REN = ["#ff4d4d","#ff9f1c","#ffd84d","#3ec46d","#3a9be8","#8a5cd6"]; const anah: string[] = n.renk ?? []; c.lineCap = 'round';
      REN.forEach((k, j) => { const q = anah[j] ? ap(anah[j], 0.5) : a; if (q <= 0) return; const an = Math.PI * (0.62 + j * 0.05), L = 520 * eo(q); c.globalAlpha = 0.9; c.lineWidth = 26; c.strokeStyle = k; c.beginPath(); c.moveTo(x, y + 40); c.lineTo(x + Math.cos(an) * L, y + 40 + Math.sin(an) * L); c.stroke(); }); break; }
    case 'birikinti': { let k = zip(a); if (n.kucul) k *= 1 - 0.92 * ap(n.kucul, 4); if (k <= 0.02) break; const rx = (n.w ?? 360) * k, ry = rx * 0.22;
      el(c, x, y, rx, ry, '#5ab8f0', 6); c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.clip(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) { const r = ((t * 0.5 + i / 4) % 1); c.globalAlpha = 1 - r; c.beginPath(); c.ellipse(x, y, rx * r, ry * r, 0, 0, Math.PI * 2); c.stroke(); } c.restore(); break; }
    case 'damlalar': { let k = a; if (n.kucul) k *= 1 - ap(n.kucul, 3); for (let i = 0; i < 4; i++) { const dx = [-220, -110, 120, 230][i]; c.save(); c.globalAlpha = k; KAR.pitpit(c, { x: x + dx, y: y - 20 + Math.sin(t * 3 + i) * 6, s: 0.28, t: t + i, i: 'mutlu', yon: 1, don: 0, bak: 0, o: {}, u, ap }); c.restore(); } break; }
    case 'kardanadam': { c.globalAlpha = a; el(c, x, y + 150, 150, 135, '#ffffff', 6); el(c, x, y - 40, 110, 100, '#ffffff', 6); el(c, x, y - 200, 80, 75, '#ffffff', 6);
      for (const dy of [-60, -20, 20]) el(c, x, y + dy, 10, 10, M); yuz(c, x, y - 210, 0.9, 'mutlu', t); c.beginPath(); c.moveTo(x, y - 195); c.lineTo(x + 70, y - 185); c.lineTo(x, y - 175); c.closePath(); c.fillStyle = '#ff8a3c'; c.fill(); c.lineWidth = 4; c.strokeStyle = M; c.stroke();
      rr(c, x - 85, y - 290, 170, 26, 8, '#3b2a4a'); rr(c, x - 55, y - 380, 110, 95, 10, '#3b2a4a'); c.lineWidth = 9; c.strokeStyle = '#8a5a3a'; c.beginPath(); c.moveTo(x - 100, y - 40); c.lineTo(x - 230, y - 120); c.moveTo(x + 100, y - 40); c.lineTo(x + 230, y - 120); c.stroke(); break; }
  }
  c.restore();
}
function gunesMini(c: C, x: number, y: number, t: number) { c.save(); c.translate(x, y); c.rotate(t * 0.4); for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); rr(c, 55, -8, 36, 16, 8, '#ffc83d'); } c.restore(); el(c, x, y, 50, 50, '#ffd84d', 5); }

// ---------- efektler ----------
function efekt(c: C, e: any, u: number, t: number, ap: (k: any, d?: number) => number) {
  const a = e.at ? ap(e.at, 0.6) : 1; if (a <= 0) return; c.save();
  switch (e.k) {
    case 'yagmur': c.globalAlpha = a * 0.85; for (let i = 0; i < 60; i++) { const x = (i * 331) % W, y = ((i * 191 + t * 520) % (H + 100)) - 50; el(c, x, y, 6, 10, '#7cc8ff', 2, '#3a9be8'); } break;
    case 'ruzgar': { const b = a * (1 - pr(u, (e.at ? u - (u - 0) : 0) + 99, 100)); c.globalAlpha = b; c.lineWidth = 9; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const x = ((t * 900 + i * 420) % (W + 600)) - 300, y = 220 + i * 95 + Math.sin(t * 2 + i) * 20; c.beginPath(); c.moveTo(x - 220, y); c.quadraticCurveTo(x - 80, y - 40, x + 20, y); c.arc(x + 20, y - 28, 28, Math.PI / 2, -Math.PI, true); c.stroke(); } break; }
    case 'simsek': { const p = e.at ? (u - 0) : 0; void p; const f = Math.max(0, 1 - Math.abs(Math.sin(t * 9)) * 2) * a; c.fillStyle = `rgba(255,255,255,${0.35 * f})`; c.fillRect(0, 0, W, H);
      c.globalAlpha = a; c.beginPath(); c.moveTo(1180, 520); c.lineTo(1120, 660); c.lineTo(1170, 660); c.lineTo(1100, 820); c.lineTo(1230, 630); c.lineTo(1175, 630); c.lineTo(1230, 520); c.closePath(); c.fillStyle = '#ffd84d'; c.fill(); c.lineWidth = 6; c.strokeStyle = M; c.stroke(); break; }
    case 'buhar': for (let i = 0; i < 9; i++) { const p = (t * 0.5 + i / 9) % 1; c.globalAlpha = a * (1 - p) * 0.85; c.lineWidth = 14; c.strokeStyle = '#fff'; c.lineCap = 'round'; const bx = e.x - 160 + i * 40; c.beginPath(); c.moveTo(bx, e.y - p * 600); c.bezierCurveTo(bx + 40, e.y - 60 - p * 600, bx - 40, e.y - 120 - p * 600, bx, e.y - 180 - p * 600); c.stroke(); } break;
    case 'atesbocekleri': { let n = 8; if (e.say) { const [a1, a2, a3] = e.say.map((k: string) => ap(k, 0.5)); n = Math.round(8 + 14 * a1 + 30 * a2 + 60 * a3); }
      for (let i = 0; i < n; i++) { const x = (i * 263) % W + Math.sin(t * 0.7 + i) * 50, y = 480 + (i * 157) % 480 + Math.sin(t * 1.1 + i * 2) * 30, k = 0.5 + 0.5 * Math.sin(t * 3 + i); const g = c.createRadialGradient(x, y, 0, x, y, 30); g.addColorStop(0, `rgba(255,240,120,${0.9 * k * a})`); g.addColorStop(1, 'rgba(255,240,120,0)'); c.fillStyle = g; c.fillRect(x - 30, y - 30, 60, 60); el(c, x, y, 4, 4, `rgba(255,255,200,${a})`); } break; }
    case 'yildizlar': for (let i = 0; i < 40; i++) { const x = (i * 197 + 60) % W, y = 40 + (i * 89) % 520; c.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + i))); yildiz4(c, x, y, 10 + (i % 3) * 6); } break;
    case 'kar': c.globalAlpha = a; for (let i = 0; i < 70; i++) { const x = (i * 331) % W + Math.sin(t + i) * 30, y = ((i * 191 + t * 90) % (H + 60)) - 30; el(c, x, y, 7 + (i % 3) * 3, 7 + (i % 3) * 3, '#ffffff'); } break;
    case 'kuslar': c.lineWidth = 6; c.strokeStyle = M; for (let i = 0; i < 5; i++) { const x = ((t * 120 + i * 380) % (W + 200)) - 100, y = 200 + i * 110, k = Math.sin(t * 10 + i) * 12; c.beginPath(); c.moveTo(x - 26, y - k); c.quadraticCurveTo(x - 12, y - 16, x, y); c.quadraticCurveTo(x + 12, y - 16, x + 26, y - k); c.stroke(); } break;
  }
  c.restore();
}

// ---------- aktör ----------
function aktor(c: C, a: any, u: number, t: number, ap: (k: any, d?: number) => number, w: (k: string) => number) {
  const ciz = KAR[a.k]; if (!ciz) return;
  let alfa = a.gir ? ap(a.gir, 0.5) : 1; if (a.cik) alfa *= 1 - ap(a.cik, 0.6); if (alfa <= 0) return;
  let x = a.x, y = a.y, s = a.s ?? 1, don = 0, i = a.i ?? 'mutlu';
  if (a.gir) s *= zip(ap(a.gir, 0.5));
  if (a.git) { const p = eo(ap(a.git[2], a.git[3] ?? 1.2)); x = lerp(x, a.git[0], p); y = lerp(y, a.git[1], p); if (a.zipgit) y -= Math.sin(p * Math.PI) * 220; }
  const zl = a.z ? (Array.isArray(a.z) ? a.z : [a.z]) : [];
  for (const k of zl) { const q = ap(k, 0.6); if (q > 0 && q < 1) y -= Math.sin(q * Math.PI) * 130 * s; }
  if (a.zz) { const q = ap(a.zz, 1.1); if (q > 0 && q < 1) y -= Math.sin(q * Math.PI) * 480 * s; }
  switch (a.h) {
    case 'uc': y += Math.sin(t * 2.5 + x) * 14; break;
    case 'yuz': y += Math.sin(t * 3 + x) * 7; x += Math.sin(t * 1.3 + x) * 12; break;
    case 'hop': y -= Math.abs(Math.sin(t * 5 + x)) * 28 * s; break;
    case 'salla': don = Math.sin(t * 6) * 0.15; break;
    case 'titre': x += Math.sin(t * 60) * 3; break;
    case 'sars': don = Math.sin(t * 12) * 0.3; break;
  }
  if (a.titre) { const q = ap(a.titre, 1.6); if (q > 0 && q < 1) x += Math.sin(t * 70) * 6; }
  if (a.don) { const q = ap(a.don, 1.4); don += q * Math.PI * 4 * (q < 1 ? 1 : 0); if (a.salin) x += Math.sin(q * Math.PI * 4) * 160 * (q < 1 ? 1 : 0); }
  if (a.i2 && u >= w(a.i2[1])) i = a.i2[0];
  if (a.kucul) s *= 1 - 0.35 * ap(a.kucul, 0.8);
  if (a.nefes) { const q = ap(a.nefes, 1.4); s *= 1 + 0.12 * Math.sin(q * Math.PI); }
  if (a.sar) { const q = ap(a.sar, 1.2); s *= 1 + 0.08 * Math.sin(q * Math.PI); }
  let hafif = 0; if (a.hafif === 1) hafif = 1; else if (a.hafif) hafif = ap(a.hafif, 2.5);
  const nef = 1 + Math.sin(t * 2.2 + x) * 0.015;
  // ışıltı/ısınma
  if (a.parla || a.isin || hafif) { const g = c.createRadialGradient(x, y, 10, x, y, 230 * s); const renk = a.isin ? `rgba(255,170,70,${0.5 * ap(a.isin, 2)})` : `rgba(200,240,255,${0.55 * (a.parla ? 1 : hafif)})`; g.addColorStop(0, renk); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - 240 * s, y - 240 * s, 480 * s, 480 * s); }
  c.save(); c.globalAlpha *= alfa * (1 - 0.45 * hafif);
  ciz(c, { x, y, s: s * nef, t, i, yon: a.yon ?? 1, don, bak: a.bak ?? 0, o: a, u, ap });
  c.restore();
  const yas = a.yas === true ? 1 : a.yas ? (u >= w(a.yas) ? 1 : 0) : 0;
  if (yas && a.k === 'pitpit') gozyasi(c, x, y + 20 * s, s, t);
  if (a.parla) for (let k = 0; k < 4; k++) { c.save(); c.globalAlpha = Math.abs(Math.sin(t * 3 + k * 1.6)); yildiz4(c, x + Math.cos(k * 1.7 + t * 0.5) * 120 * s, y + Math.sin(k * 1.7 + t * 0.5) * 140 * s, 16); c.restore(); }
}

const ARKA_NESNE = ['gokkusagi', 'birikinti', 'kardanadam', 'isinlar', 'prizma'];
let HIK_BASLIK: Record<string, string> = { en: '', tr: '' };

// ---------- ses düzeni ----------
// Konuşma hep önde: anlatım -18 LUFS, müzik dosyaları -20 LUFS (önceden ölçülüp yazıldı). Müzik konuşmasız anlarda
// MUZIK.acik, konuşurken onun MUZIK.konusma katı; ortam sesi -38 dB RMS tabanlı, konuşurken 0.35 katı.
export const MUZIK = { acik: 0.24, konusma: 0.45, ortamKonusma: 0.35, efekt: 0.3 };
const ORTAM_RMS: Record<string, number> = { 'ortam-damla': -22.9, 'ortam-ruzgar': -16.1, 'ortam-su': -13.5 };
const ortamSeviye = (ses: string, onem: number) => 10 ** ((-38 - (ORTAM_RMS[ses] ?? -18)) / 20) * Math.min(1, onem / 0.45 + 0.35);
const BOLUM_MUZIK = ['dreamy-flashback', 'carefree', 'carefree', 'dreamy-flashback', 'meditation-impromptu-01', 'dreamy-flashback'];
function sesPlani(veri: Veri, HK: any, fps: number, toplam: number) {
  const N = Math.ceil(toplam * fps) + 1, konus = new Float32Array(N);
  for (const w of veri.words) { const a = Math.floor((w.t - 0.15) * fps), b = Math.ceil((w.t + w.d + 0.45) * fps); for (let k = Math.max(0, a); k < Math.min(N, b); k++) konus[k] = 1; }
  const duz = new Float32Array(N); let v = 0; for (let k = 0; k < N; k++) { v += (konus[k] - v) * (konus[k] > v ? 0.35 : 0.06); duz[k] = v; }
  const S = veri.sahne, SC: any[] = []; let m = 'cayir', z = 'gun'; for (const s of HK.sahneler) { m = s.m ?? m; z = s.z ?? z; SC.push({ ...s, m, z }); }
  // müzik: bölüm başına parça, aynı parçalar birleşir
  const muzik: { ses: string; f0: number; f1: number }[] = []; let bi = -1;
  SC.forEach((sc, i) => { if (sc.bolum) bi++; const ses = sc.muzik ?? BOLUM_MUZIK[Math.max(0, bi)] ?? 'dreamy-flashback'; const f0 = Math.round((i ? S[i].t0 - (sc.bolum ? 1.6 : 0.3) : 0) * fps);
    if (muzik.at(-1)?.ses === ses) return; if (muzik.length) muzik.at(-1)!.f1 = f0 + fps; muzik.push({ ses, f0, f1: N }); });
  // ortam: mekân + zaman
  const ortamOf = (sc: any): [string, number] | null => sc.z === 'gece' ? (sc.m === 'gol' ? ['ortam-su', 0.06] : ['ortam-ruzgar', 0.05]) : sc.m === 'dere' ? ['ortam-su', sc.akis ? 0.3 : 0.2] : sc.m === 'gol' ? ['ortam-su', 0.1] : sc.m === 'gok' ? ['ortam-ruzgar', 0.12] : ['ortam-ruzgar', 0.06];
  const ortam: { ses: string; vol: number; f0: number; f1: number }[] = [];
  SC.forEach((sc, i) => { const o = ortamOf(sc); if (!o) return; const f0 = Math.round((i ? S[i].t0 - 0.3 : 0) * fps); const vol = ortamSeviye(o[0], o[1]); const son = ortam.at(-1);
    if (son && son.ses === o[0] && Math.abs(son.vol - vol) < 1e-6) return; if (son) son.f1 = f0 + Math.round(fps * 0.8); ortam.push({ ses: o[0], vol, f0, f1: N }); });
  // efektler: sözdeki ana bağlı
  const efekt: { ses: string; f: number; vol: number; d?: number }[] = [];
  SC.forEach((sc, i) => { const soz = veri.words.filter((x) => x.s === i);
    const ws = (key: string) => { const p = key.split('|'); const kk = (veri.dil === 'en' ? p[0] : p[1] ?? p[0]).split(' ').map(sade); for (let j = 0; j < soz.length; j++) if (kk.every((q, mm) => soz[j + mm] && sade(soz[j + mm].w).startsWith(q))) return soz[j].t; return S[i].t0; };
    for (const n of sc.n ?? []) if (n.k === 'sicrama') efekt.push({ ses: 'adim-su', f: Math.round(ws(n.at) * fps), vol: 0.3 });
    for (const e of sc.e ?? []) { if (e.k === 'simsek') efekt.push({ ses: 'gum', f: Math.round(ws(e.at) * fps), vol: 0.22 }); if (e.k === 'yagmur') efekt.push({ ses: 'ortam-damla', f: Math.round((e.at ? ws(e.at) : S[i].t0) * fps), vol: ortamSeviye('ortam-damla', 0.3), d: Math.round((S[i].t1 - (e.at ? ws(e.at) : S[i].t0) + 0.5) * fps) }); }
  });
  return { duz, muzik, ortam, efekt, N };
}

export function MasalVideo({ veri, hikaye, ses, sessiz, dikey }: { veri: Veri; hikaye: any; ses: string; sessiz?: number; dikey?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps;
  const CW = dikey ? 1080 : W, CH = dikey ? 1920 : H;
  useLayoutEffect(() => {
    const c = ref.current!.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    const HK = hikaye; HIK_BASLIK = HK.baslik; DIL = veri.dil; TT = t;
    // sahne özellikleri (m, z, cx öncekinden devralınır)
    const SC: any[] = []; let m = 'cayir', z = 'gun', cx = 960; for (const s of HK.sahneler) { m = s.m ?? m; z = s.z ?? z; cx = s.cx ?? cx; SC.push({ ...s, m, z, cx }); }
    const S = veri.sahne; let i = 0; for (let k = 0; k < S.length; k++) if (t >= S[k].t0 - (SC[k].bolum ? 1.9 : 0.3)) i = k;
    const sc = SC[i], u = t - S[i].t0;
    const sozler = veri.words.filter((x) => x.s === i);
    const w = (key: string) => { if (typeof key !== 'string') return 0; const p = key.split('|'); const kk = (DIL === 'en' ? p[0] : p[1] ?? p[0]); const parca = kk.split(' ').map(sade);
      for (let j = 0; j < sozler.length; j++) if (parca.every((q, mm) => sozler[j + mm] && sade(sozler[j + mm].w).startsWith(q))) return sozler[j].t - S[i].t0; return 0; };
    const ap = (k: any, d = 0.5) => (k === true || k === 1 ? 1 : typeof k === 'number' ? k : pr(u, w(k), w(k) + d));
    const kz = 1.02 + 0.012 * Math.sin(t * 0.12);
    c.save();
    if (dikey) { const o = CH / H; c.scale(o, o); c.translate(-(sc.cx - CW / o / 2), 0); }
    c.translate(W / 2, H / 2); c.scale(kz, kz); c.translate(-W / 2, -H / 2);
    zemin(c, sc, sc.z, u, t, ap);
    if (sc.z2) { const a2 = ap(sc.z2[1], 3); if (a2 > 0) { c.save(); c.globalAlpha = a2; zemin(c, sc, sc.z2[0], u, t, ap); c.restore(); } }
    for (const e of sc.e ?? []) if (['yildizlar', 'kuslar'].includes(e.k)) efekt(c, e, u, t, ap);
    for (const n of sc.n ?? []) if (ARKA_NESNE.includes(n.k)) nesne(c, n, u, t, ap, w);
    for (const a of sc.a ?? []) aktor(c, a, u, t, ap, w);
    for (const e of sc.e ?? []) if (!['yildizlar', 'kuslar'].includes(e.k)) efekt(c, e, u, t, ap);
    for (const n of sc.n ?? []) if (!ARKA_NESNE.includes(n.k)) nesne(c, n, u, t, ap, w);
    c.restore();
    // mekân değişiminde yumuşak geçiş
    const onceki = SC[i - 1]; if (onceki && (onceki.m !== sc.m || onceki.z !== sc.z) && u < 0.3 && u > -0.4) { c.fillStyle = `rgba(255,255,255,${0.7 * (1 - pr(u, -0.35, 0.3))})`; c.fillRect(0, 0, CW, CH); }
    // bölüm kartı
    if (sc.bolum) { const a = pr(u, -1.8, -1.3) * (1 - pr(u, 2.6, 3.3)); if (a > 0) { const ttl = sc.bolum[DIL]; c.save(); c.globalAlpha = a; c.font = `900 70px ${FONT}`; const ww = c.measureText(ttl).width + 110; const z2 = zip(pr(u, -1.8, -1.2));
      c.translate(CW / 2, 110); c.scale(z2, z2); rr(c, -ww / 2, -60, ww, 120, 60, '#ffd84d', 7); yazi(c, ttl, 0, 3, 70, M, 1, '#fff'); c.restore(); } }
    // Shorts: üstte soru kartı
    if (dikey && HK.ust) { const sat: string[] = HK.ust[DIL]; const a = eo(pr(t, 0.2, 0.8)); c.save(); c.globalAlpha = a; c.font = `900 76px ${FONT}`; const ww = Math.max(...sat.map((x) => c.measureText(x).width)) + 100;
      rr(c, CW / 2 - ww / 2, 150, ww, 90 * sat.length + 60, 50, 'rgba(255,255,255,.93)', 7); sat.forEach((x, k) => yazi(c, x, CW / 2, 225 + k * 90, 76, k ? '#ff6b9a' : M, 1, '#fff')); c.restore(); }
    // köşe imza
    yazi(c, 'Dodi', CW - 110, CH - 60, 44, '#ffffff', 0.55);
    // Türkçe karaoke altyazı
    if (DIL === 'tr' && u >= 0 && t < S[i].t1 + 0.3) {
      const ak = sozler; const simdi = ak.findIndex((x) => t >= x.t && t < x.t + x.d + 0.1); const son = Math.max(0, ak.findIndex((x) => x.t > t) - 1);
      const G = dikey ? 4 : 6, grup = Math.floor((simdi >= 0 ? simdi : son) / G), g = ak.slice(grup * G, grup * G + G);
      const yy = dikey ? CH - 360 : 950, mx = dikey ? 960 : 1500, fb0 = dikey ? 62 : 54;
      if (g.length) { let fb = fb0; c.save(); c.font = `900 ${fb}px ${FONT}`; const metin = g.map((x) => x.w).join(' '); while (c.measureText(metin).width > mx && fb > 34) { fb -= 2; c.font = `900 ${fb}px ${FONT}`; } const mw = c.measureText(metin).width + 70;
        rr(c, CW / 2 - mw / 2, yy, mw, fb + 38, 30, 'rgba(40,24,60,.72)'); let x0 = CW / 2 - (mw - 70) / 2; c.textBaseline = 'middle';
        for (const x of g) { const s = x.w + ' '; c.fillStyle = t >= x.t ? (t < x.t + x.d + 0.1 ? '#ffd23e' : '#fff') : 'rgba(255,255,255,.55)'; c.fillText(s, x0, yy + (fb + 38) / 2); x0 += c.measureText(s).width; } c.restore(); }
    }
    // son kartı
    const sonT = S.at(-1)!.t1 + 0.8;
    if (t > sonT) { const a = eo(pr(t, sonT, sonT + 1)); c.save(); c.globalAlpha = a * 0.8; c.fillStyle = '#1c1430'; c.fillRect(0, 0, CW, CH); c.restore(); const y0 = CH / 2 - 110;
      yazi(c, DIL === 'en' ? 'The End' : 'Son', CW / 2, y0, 150, '#ffd84d', a); yazi(c, dikey ? 'Dodi' : (DIL === 'en' ? 'Sweet dreams!' : 'Tatlı rüyalar!'), CW / 2, y0 + 160, 70, '#fff', a);
      c.save(); c.globalAlpha = a; el(c, CW / 2, y0 + 360, 70, 70, '#fff6c8', 6); yuz(c, CW / 2 - 8, y0 + 365, 0.8, 'uyku', t); c.restore(); }
  }, [f, veri, hikaye]);
  const P = useMemo(() => sesPlani(veri, hikaye, fps, veri.sure + 5), [veri, hikaye, fps]);
  const yum = (fr: number, f0: number, f1: number) => Math.min(1, fr / (fps * 1.5), (f1 - f0 - fr) / (fps * 1.5));
  return (<AbsoluteFill style={{ background: '#000' }}><canvas ref={ref} width={CW} height={CH} />
    {!sessiz && ses && <Audio src={staticFile(ses)} />}
    {P.muzik.map((m, k) => <Sequence key={'m' + k} from={m.f0} durationInFrames={m.f1 - m.f0}><Audio loop src={staticFile(`masal-muzik/${m.ses}.mp3`)} volume={(fr) => MUZIK.acik * Math.max(0, yum(fr, m.f0, m.f1)) * (1 - (1 - MUZIK.konusma) * (P.duz[m.f0 + fr] ?? 0))} /></Sequence>)}
    {P.ortam.map((o, k) => <Sequence key={'o' + k} from={o.f0} durationInFrames={o.f1 - o.f0}><Audio loop src={staticFile(`sfx/${o.ses}.wav`)} volume={(fr) => o.vol * Math.max(0, yum(fr, o.f0, o.f1)) * (1 - (1 - MUZIK.ortamKonusma) * (P.duz[o.f0 + fr] ?? 0))} /></Sequence>)}
    {P.efekt.map((e, k) => <Sequence key={'e' + k} from={e.f} durationInFrames={e.d ?? fps * 3}><Audio loop={!!e.d} src={staticFile(`sfx/${e.ses}.wav`)} volume={e.vol * MUZIK.efekt / 0.3} /></Sequence>)}
  </AbsoluteFill>);
}

// Kapak (1920x1080 uzun / 1080x1920 Shorts): hikâyedeki "kapak" sahnesi her şey belirmiş hâliyle + iki satır merak yazısı
export function MasalKapak({ hikaye, dil, dikey }: { hikaye: any; dil: string; dikey?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const CW = dikey ? 1080 : W, CH = dikey ? 1920 : H;
  useLayoutEffect(() => {
    const c = ref.current!.getContext('2d')!; DIL = dil; TT = 2.5; HIK_BASLIK = hikaye.baslik;
    const sc = { m: 'cayir', z: 'gun', cx: 960, ...hikaye.kapak }; const ap = () => 1, w = () => 0, u = 30, t = 2.5;
    c.save(); if (dikey) { const o = CH / H; c.scale(o, o); c.translate(-(sc.cx - CW / o / 2), 0); }
    zemin(c, sc, sc.z, u, t, ap);
    for (const n of sc.n ?? []) if (ARKA_NESNE.includes(n.k)) nesne(c, n, u, t, ap, w);
    for (const a of sc.a ?? []) aktor(c, { ...a, gir: undefined, git: undefined, z: undefined, zz: undefined }, u, t, ap, w);
    for (const e of sc.e ?? []) efekt(c, e, u, t, ap);
    for (const n of sc.n ?? []) if (!ARKA_NESNE.includes(n.k)) nesne(c, { ...n, at: undefined }, u, t, ap, w);
    c.restore();
    const [s1, s2] = (sc.yazi?.[dil] ?? ['', '']) as string[];
    const kx = dikey ? CW / 2 : (sc.yaziX ?? 1400), ky = dikey ? 420 : (sc.yaziY ?? 520);
    c.save(); c.rotate(dikey ? 0 : -0.04); yazi(c, s1, kx, ky, dikey ? 110 : 120, '#ffffff', 1, M); yazi(c, s2, kx, ky + (dikey ? 140 : 150), dikey ? 140 : 160, '#ffd84d', 1, M); c.restore();
    rr(c, 40, 40, 230, 90, 45, 'rgba(255,255,255,.92)', 6); yazi(c, 'Dodi', 155, 88, 60, '#ff6b9a', 1, '#fff');
  }, [hikaye, dil, dikey]);
  return <AbsoluteFill><canvas ref={ref} width={CW} height={CH} /></AbsoluteFill>;
}
