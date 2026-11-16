// Destan/aksiyon dizileri için mekânlar (ölçüden bağımsız: dikey ve yatay tuvalde çalışır).
// koy-gunduz, koy-yangin, kervan, tas-ocagi, zindan, avlu, arena, loca
import { h } from './dizi.js';
import { eo, pr } from './cizim.js';

export const DESTAN_MEKANLAR = ['koy-gunduz', 'koy-yangin', 'kervan', 'tas-ocagi', 'zindan', 'avlu', 'arena', 'loca'];

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
  ctx.save();
  const z = 1 + Math.min(1, kamera) * 0.05;
  ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.55);
  const yer = H * 0.74;

  if (ad === 'koy-gunduz') {
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
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, ad === 'zindan' || ad === 'koy-yangin' ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
