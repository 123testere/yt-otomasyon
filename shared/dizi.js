// Animasyonlu dizi çizim kiti (Gece Hikâyeleri kanalı): karakterler ve mekânlar tamamen kodla çizilir.
// Karakter: göğüs çekimi (diyalog kadrajı), konuşurken ağız oynar, göz kırpar, ifade değişir, nefes alır.
// Mekân: hazır sahneler (meydan, kuyu, ev içi, orman, yol, saat kulesi içi) + gece/gündüz + sis/yağmur/şimşek.
// Hem Remotion (tarayıcı) hem doğrulayıcı (Node) kullanır; bağımlılık yok.
import { cl, eo, h, pr } from './cizim.js';

export const IFADELER = ['notr', 'endiseli', 'gulumsuyor', 'uzgun', 'korkmus', 'saskin', 'kizgin', 'dusunceli', 'supheli', 'fisilti'];
export const MEKANLAR = ['meydan', 'kuyu', 'ev-ic', 'orman', 'yol', 'kule-ic'];
export const ZAMANLAR = ['gece', 'gunduz', 'safak'];
export const EFEKTLER = ['sis', 'yagmur', 'simsek', 'titreyen-isik', 'ruzgar'];
export const SAC_STILLERI = ['kisa', 'uzun', 'atkuyrugu', 'topuz', 'dagnik', 'kel', 'basortusu'];

const SEMA = {
  gece: ['#070C18', '#14223A', '#22304A'],
  gunduz: ['#7E8C99', '#A9B3BA', '#C9CFD1'],
  safak: ['#2A2440', '#7A4B5A', '#D8906A'],
};

const hex = (c, a = 1) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
// Rengi koyulaştır / aç (k < 1 koyu, k > 1 açık)
export function ton(c, k) {
  const n = parseInt(c.slice(1), 16);
  const f = (v) => Math.round(cl(k < 1 ? v * k : v + (255 - v) * (k - 1), 0, 255));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Mürekkep hatlı yumuşak şekil (çizgi film görünümü): noktalar kapalı bir eğriyle doldurulur.
export function sekil(ctx, pts, { fill, stroke = '#0C0A10', w = 5, close = true } = {}) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i < pts.length - (close ? 0 : 1); i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  if (close) {
    const p = pts[0];
    const q = pts[1];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    ctx.closePath();
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w > 0) { ctx.lineWidth = w; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}

export const elips = (cx, cy, rx, ry, n = 24, a0 = 0, a1 = Math.PI * 2) => {
  const q = [];
  for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * i) / n; q.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return q;
};

// --- Karakter -----------------------------------------------------------------------------------------------

// Göz kırpma: her karakter kendi tohumuyla 2,8-5 sn arayla, 0,14 sn kapanır.
export function kirpma(t, seed) {
  let at = h(seed) * 2;
  for (let k = 0; k < 60 && at <= t + 1; k++) {
    if (t >= at && t < at + 0.14) return 1 - Math.abs((t - at) / 0.07 - 1);
    at += 2.8 + h(seed + k * 3.3) * 2.2;
  }
  return 0;
}

export const KAS = {
  // [kaş iç uç yükseklik, kaş dış uç, göz kapağı (0 açık-1 kapalı), ağız kıvrımı (+ gülümseme), göz büyüklüğü]
  notr: [0, 0, 0.1, 0, 1], endiseli: [12, -2, 0.12, -0.5, 1.05], gulumsuyor: [2, 4, 0.18, 1, 0.95], uzgun: [10, -6, 0.3, -0.8, 0.95],
  korkmus: [14, 2, 0, -0.4, 1.18], saskin: [16, 14, 0, 0, 1.22], kizgin: [-12, 6, 0.28, -0.6, 0.95],
  dusunceli: [4, -2, 0.42, -0.1, 0.95], supheli: [-8, 8, 0.45, 0.2, 0.92], fisilti: [6, 0, 0.25, -0.2, 1],
};

// def: { ten, sac, sacStil, goz, kiyafet, kiyafet2, yas: genc|orta|yasli, cinsiyet: k|e, sakal: yok|biyik|sakal|kirli, sapka: yok|kasket, gozluk }
// o: { x, y (göğsün alt kenarı), s, t, ifade, agiz (0-1 açıklık), bakis (-1 sol..1 sağ), isik (0-1 fener ışığı), solgun (konuşmayan) }
export function karakter(ctx, def, o) {
  const { x, y, s = 1, t = 0, ifade = 'notr', agiz = 0, bakis = 0, isik = 0.6, solgun = 0, seed = 1, yon = 1 } = o;
  const yasli = def.yas === 'yasli';
  const kadin = def.cinsiyet === 'k';
  const kas = KAS[ifade] ?? KAS.notr;
  const nefes = Math.sin(t * 1.6 + seed) * 4;
  const sallanma = Math.sin(t * 0.9 + seed * 2) * 0.012 + (yasli ? 0.02 : 0);
  const ink = '#0C0A10';
  const tenR = def.ten ?? '#E2B48C';
  const golge = ton(tenR, 0.78);

  ctx.save();
  // Konuşmayan karakter biraz gölgede kalır (dikkat konuşana gider).
  if (solgun > 0) ctx.filter = `brightness(${1 - 0.38 * solgun}) saturate(${1 - 0.3 * solgun})`;
  ctx.translate(x, y);
  ctx.scale(s * yon, s);

  // Gövde (omuzlar ve göğüs)
  const omuz = kadin ? 205 : 235;
  const govde = [[-omuz - 40, 10], [-omuz, -210 + nefes], [-omuz + 50, -300 + nefes], [-70, -330 + nefes], [70, -330 + nefes],
    [omuz - 50, -300 + nefes], [omuz, -210 + nefes], [omuz + 40, 10]];
  sekil(ctx, govde, { fill: def.kiyafet ?? '#4A3B5C', w: 6 });
  // Yaka / iç kıyafet
  sekil(ctx, [[-70, -330 + nefes], [0, -230 + nefes], [70, -330 + nefes], [40, -335 + nefes], [0, -280 + nefes], [-40, -335 + nefes]],
    { fill: def.kiyafet2 ?? ton(def.kiyafet ?? '#4A3B5C', 1.35), w: 4 });
  // Kıyafet kıvrımları
  ctx.strokeStyle = hex('#000000', 0.25); ctx.lineWidth = 4;
  for (const dx of [-120, 120]) { ctx.beginPath(); ctx.moveTo(dx, -240 + nefes); ctx.quadraticCurveTo(dx * 1.1, -120, dx * 0.9, 0); ctx.stroke(); }

  // Boyun
  sekil(ctx, [[-48, -300 + nefes], [-44, -400], [44, -400], [48, -300 + nefes]], { fill: golge, w: 5 });

  // Baş (hafif eğim ve bakış yönüne dönüş)
  ctx.save();
  ctx.translate(0, -470 + nefes * 0.6);
  ctx.rotate(sallanma + bakis * 0.04);
  const bx = bakis * 10;

  // Arka saç (uzun saç ve başörtüsünün arka kısmı)
  if (def.sacStil === 'uzun') sekil(ctx, [[-150, -40], [-165, 120], [-150, 240], [-60, 260], [60, 260], [150, 240], [165, 120], [150, -40]], { fill: def.sac, w: 5 });
  if (def.sacStil === 'atkuyrugu') sekil(ctx, [[120, -60], [210, -20], [230, 120], [190, 200], [160, 90]], { fill: def.sac, w: 5 });
  if (def.sacStil === 'basortusu') {
    sekil(ctx, [[-175, -40], [-185, 120], [-170, 230], [-90, 300], [90, 300], [170, 230], [185, 120], [175, -40], [0, -210]], { fill: def.sac, w: 6 });
  }

  // Kulaklar
  if (def.sacStil !== 'basortusu') {
    for (const sx of [-1, 1]) sekil(ctx, elips(sx * 148 + bx * 0.3, 10, 22, 36, 14), { fill: golge, w: 4 });
  }
  // Yüz
  const cene = kadin ? 0.92 : 1;
  const yuz = [[-140, -60], [-150, 40], [-125 * cene, 140], [-60 * cene, 200], [0, 214], [60 * cene, 200], [125 * cene, 140],
    [150, 40], [140, -60], [100, -150], [0, -175], [-100, -150]].map(([px, py]) => [px + bx * (1 - Math.abs(px) / 160) * 0.6, py]);
  sekil(ctx, yuz, { fill: tenR, w: 6 });
  // Yan gölge (ışık bir taraftan)
  ctx.save();
  sekil(ctx, yuz, { w: 0 });
  ctx.clip();
  const g = ctx.createLinearGradient(-160, 0, 160, 0);
  g.addColorStop(0, hex('#000000', 0)); g.addColorStop(0.55, hex('#000000', 0.02)); g.addColorStop(1, hex('#1A1030', 0.32));
  ctx.fillStyle = g; ctx.fillRect(-170, -200, 340, 430);
  ctx.restore();

  // Yanaklar
  ctx.fillStyle = hex('#D2645A', kadin ? 0.22 : 0.12);
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 82 + bx, 75, 30, 18, 0, 0, Math.PI * 2); ctx.fill(); }

  // Yaşlılık çizgileri
  if (yasli) {
    ctx.strokeStyle = hex('#5A3A2A', 0.55); ctx.lineWidth = 3;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sx * 118 + bx, -10); ctx.quadraticCurveTo(sx * 130 + bx, 5, sx * 122 + bx, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx * 52 + bx, 90); ctx.quadraticCurveTo(sx * 68 + bx, 130, sx * 50 + bx, 160); ctx.stroke();
    }
    for (const yy of [-110, -92]) { ctx.beginPath(); ctx.moveTo(-50 + bx, yy); ctx.quadraticCurveTo(bx, yy - 6, 50 + bx, yy); ctx.stroke(); }
  }

  // Gözler
  const kirp = kirpma(t, seed * 7.1);
  const kapak = cl(kas[2] + kirp * (1 - kas[2]));
  const gb = kas[4];
  for (const sx of [-1, 1]) {
    const gx = sx * 58 + bx;
    const gy = -10;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(gx, gy, 30 * gb, 24 * gb * (1 - kapak * 0.98), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#F6F1E8'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
    ctx.clip();
    const ix = gx + bakis * 12;
    ctx.fillStyle = def.goz ?? '#4A2E1E'; ctx.beginPath(); ctx.arc(ix, gy + 2, 15 * gb, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0B0806'; ctx.beginPath(); ctx.arc(ix, gy + 2, 7.5 * gb, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hex('#FFFFFF', 0.9); ctx.beginPath(); ctx.arc(ix - 5, gy - 4, 4, 0, Math.PI * 2); ctx.fill();
    // Fener ışığının gözde parıltısı
    ctx.fillStyle = hex('#FFC873', 0.5 * isik); ctx.beginPath(); ctx.arc(ix + 5, gy + 6, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Üst kapak çizgisi
    ctx.beginPath(); ctx.ellipse(gx, gy, 31 * gb, 25 * gb * (1 - kapak * 0.98), 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke();
    // Kaş
    const ic = -55 - kas[0];
    const dis = -52 - kas[1];
    ctx.beginPath(); ctx.moveTo(gx - sx * 32, ic); ctx.quadraticCurveTo(gx, Math.min(ic, dis) - 10, gx + sx * 34, dis);
    ctx.lineWidth = yasli ? 9 : 10; ctx.strokeStyle = def.sacStil === 'basortusu' || def.sacStil === 'kel' ? ton(def.kas ?? '#3A2A20', 1) : (def.kas ?? def.sac); ctx.lineCap = 'round'; ctx.stroke();
  }
  if (def.gozluk) {
    ctx.lineWidth = 5; ctx.strokeStyle = '#2A2420';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 58 + bx, -8, 40, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-18 + bx, -10); ctx.lineTo(18 + bx, -10); ctx.stroke();
  }

  // Burun
  ctx.beginPath(); ctx.moveTo(4 + bx * 1.3, 10); ctx.quadraticCurveTo(22 + bx * 1.4, 62, bx * 1.3 - 4, 70);
  ctx.lineWidth = 5; ctx.strokeStyle = hex('#3A2018', 0.75); ctx.stroke();

  // Bıyık / sakal
  if (def.sakal === 'sakal' || def.sakal === 'kirli') {
    ctx.save(); sekil(ctx, yuz, { w: 0 }); ctx.clip();
    if (def.sakal === 'kirli') {
      // Kirli sakal: çene boyunca seyrek kıl noktaları
      ctx.fillStyle = hex('#2A2420', 0.5);
      for (let k = 0; k < 160; k++) {
        const a = Math.PI * (0.08 + 0.84 * h(k * 1.7));
        const r = 0.72 + 0.28 * h(k * 3.1);
        ctx.fillRect(Math.cos(a) * 128 * r + bx, 60 + Math.sin(a) * 160 * r, 3, 3);
      }
    } else {
      sekil(ctx, [[-130, 90], [-60, 120], [0, 112], [60, 120], [130, 90], [120, 170], [60, 225], [0, 240], [-60, 225], [-120, 170]], { fill: def.sakalRenk ?? def.sac, w: 0 });
    }
    ctx.restore();
  }

  // Ağız: konuşurken açılır (agiz 0-1), ifadeye göre kıvrılır
  const my = 128;
  const kiv = kas[3] * 14;
  const ac = cl(agiz) * (ifade === 'fisilti' ? 0.45 : 1);
  if (ac > 0.06) {
    const w = 34 + ac * 8;
    const hh = 6 + ac * 34;
    ctx.beginPath();
    ctx.moveTo(-w + bx, my - kiv * 0.5);
    ctx.quadraticCurveTo(bx, my - 10 - kiv, w + bx, my - kiv * 0.5);
    ctx.quadraticCurveTo(bx, my + hh * 1.4 - kiv * 0.2, -w + bx, my - kiv * 0.5);
    ctx.fillStyle = '#3A1218'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = ink; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#F2EEE6'; ctx.fillRect(-w + bx, my - 14 - kiv, w * 2, 12);
    ctx.fillStyle = '#B4505A'; ctx.beginPath(); ctx.ellipse(bx, my + hh, w * 0.6, hh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.moveTo(-36 + bx, my - kiv * 0.4); ctx.quadraticCurveTo(bx, my + kiv, 36 + bx, my - kiv * 0.4);
    ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.stroke();
  }
  if (def.sakal === 'biyik' || def.sakal === 'sakal') {
    sekil(ctx, [[-62 + bx, my - 6], [-30 + bx, my - 30], [0 + bx, my - 24], [30 + bx, my - 30], [62 + bx, my - 6], [30 + bx, my - 14], [0 + bx, my - 16], [-30 + bx, my - 14]],
      { fill: def.sakalRenk ?? def.sac, w: 4 });
  }

  // Ön saç / başörtüsü / şapka
  const sac = def.sac ?? '#2A1D16';
  if (def.sacStil === 'basortusu') {
    sekil(ctx, [[-165, 60], [-160, -80], [-110, -165], [0, -200], [110, -165], [160, -80], [165, 60], [140, 40], [130, -60], [80, -130], [0, -150], [-80, -130], [-130, -60], [-140, 40]],
      { fill: sac, w: 6 });
    // Başörtüsü deseni
    ctx.fillStyle = hex('#FFFFFF', 0.25);
    for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(-120 + k * 30, -150 + Math.abs(k - 4) * 14, 5, 0, Math.PI * 2); ctx.fill(); }
  } else if (def.sacStil !== 'kel') {
    const tepe = def.sacStil === 'dagnik'
      ? [[-150, -20], [-170, -110], [-120, -150], [-130, -205], [-60, -190], [-20, -240], [30, -195], [90, -225], [110, -170], [170, -150], [150, -20], [110, -110], [40, -120], [-30, -100], [-100, -120]]
      : def.sacStil === 'kisa'
        ? [[-148, -30], [-155, -120], [-90, -190], [0, -205], [90, -190], [155, -120], [148, -30], [128, -100], [60, -135], [-20, -125], [-90, -135], [-128, -100]]
        : [[-150, 40], [-160, -100], [-100, -190], [0, -210], [100, -190], [160, -100], [150, 40], [130, -60], [70, -130], [10, -110], [-60, -135], [-125, -70]];
    sekil(ctx, tepe, { fill: sac, w: 6 });
    if (def.sacStil === 'topuz') sekil(ctx, elips(0, -225, 55, 45, 16), { fill: sac, w: 6 });
    // Saç parlaklığı
    ctx.strokeStyle = hex('#FFFFFF', 0.12); ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(-20, -40, 140, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  }
  if (def.sapka === 'kasket') {
    sekil(ctx, [[-165, -90], [-150, -170], [-60, -215], [60, -215], [150, -170], [165, -90]], { fill: def.sapkaRenk ?? '#3A3A3A', w: 6 });
    sekil(ctx, [[-120, -95], [60, -100], [210, -70], [150, -55], [-130, -70]], { fill: ton(def.sapkaRenk ?? '#3A3A3A', 0.75), w: 5 });
  }
  ctx.restore(); // baş

  ctx.restore();
}

// --- Mekânlar -----------------------------------------------------------------------------------------------

function gokyuzu(ctx, W, H, zaman, t) {
  const c = SEMA[zaman] ?? SEMA.gece;
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  g.addColorStop(0, c[0]); g.addColorStop(0.6, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (zaman === 'gece') {
    for (let i = 0; i < 140; i++) {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + h(i) * 2) + i));
      ctx.fillStyle = hex('#FFFFFF', 0.6 * a * h(i * 3.3)); ctx.fillRect(h(i * 1.7) * W, h(i * 9.1) * H * 0.45, 2.5, 2.5);
    }
    const mx = W * 0.78;
    const my = H * 0.13;
    const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 260);
    mg.addColorStop(0, hex('#E8E4D0', 0.35)); mg.addColorStop(1, hex('#E8E4D0', 0));
    ctx.fillStyle = mg; ctx.fillRect(mx - 260, my - 260, 520, 520);
    ctx.fillStyle = '#E9E5D2'; ctx.beginPath(); ctx.arc(mx, my, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hex('#B8B4A0', 0.5);
    for (const [dx, dy, r] of [[-20, -15, 14], [18, 12, 10], [-5, 25, 7]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill(); }
  }
}

function daglar(ctx, W, H, zaman) {
  const koyu = zaman === 'gunduz' ? ['#5E6B72', '#4A565C'] : zaman === 'safak' ? ['#3A2E44', '#2A2234'] : ['#0E1828', '#0A1220'];
  for (const [k, renk] of koyu.entries()) {
    ctx.fillStyle = renk;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * (0.36 + k * 0.06) - Math.sin(x * 0.006 + k * 2) * 90 - h(x + k) * 30);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
}

function cam(ctx, x, y, w, hh, renk) {
  ctx.fillStyle = renk; ctx.fillRect(x, y, w, hh);
  ctx.fillStyle = hex('#000000', 0.5); ctx.fillRect(x + w / 2 - 2, y, 4, hh); ctx.fillRect(x, y + hh / 2 - 2, w, 4);
}

// Karaçam: koyu çam silüeti
function cam1(ctx, x, y, s, renk) {
  ctx.fillStyle = renk;
  for (let k = 0; k < 5; k++) {
    const yy = y - k * 70 * s;
    const ww = (120 - k * 20) * s;
    ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.lineTo(x, yy - 120 * s); ctx.lineTo(x + ww, yy); ctx.closePath(); ctx.fill();
  }
  ctx.fillRect(x - 8 * s, y, 16 * s, 40 * s);
}

function ev(ctx, x, y, w, hh, zaman, t, seed) {
  const duvar = zaman === 'gunduz' ? '#6B5444' : '#2A2028';
  ctx.fillStyle = duvar; ctx.fillRect(x, y - hh, w, hh);
  ctx.strokeStyle = hex('#000000', 0.35); ctx.lineWidth = 3;
  for (let yy = y - hh + 22; yy < y; yy += 22) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  ctx.fillStyle = zaman === 'gunduz' ? '#3A2A26' : '#160F16';
  ctx.beginPath(); ctx.moveTo(x - 30, y - hh); ctx.lineTo(x + w / 2, y - hh - w * 0.45); ctx.lineTo(x + w + 30, y - hh); ctx.closePath(); ctx.fill();
  const yanik = zaman !== 'gunduz' && h(seed) > 0.3;
  const titre = 0.85 + Math.sin(t * 7 + seed) * 0.08;
  cam(ctx, x + w * 0.2, y - hh * 0.7, w * 0.22, hh * 0.3, yanik ? hex('#F2B45A', titre) : '#1A2230');
  cam(ctx, x + w * 0.58, y - hh * 0.7, w * 0.22, hh * 0.3, yanik && h(seed * 2) > 0.5 ? hex('#F2B45A', titre) : '#1A2230');
  if (yanik) {
    const g = ctx.createRadialGradient(x + w * 0.3, y - hh * 0.55, 10, x + w * 0.3, y - hh * 0.55, w * 0.7);
    g.addColorStop(0, hex('#F2B45A', 0.18)); g.addColorStop(1, hex('#F2B45A', 0));
    ctx.fillStyle = g; ctx.fillRect(x - w * 0.4, y - hh * 1.2, w * 1.4, hh * 1.4);
  }
}

// Saat kulesi: kadran saati gösterir ("03:17")
function saatKulesi(ctx, x, y, s, saat, zaman, t) {
  const tas = zaman === 'gunduz' ? '#7A7068' : '#2E2A32';
  ctx.fillStyle = tas;
  ctx.fillRect(x - 110 * s, y - 900 * s, 220 * s, 900 * s);
  ctx.strokeStyle = hex('#000000', 0.35); ctx.lineWidth = 3;
  for (let yy = y - 880 * s; yy < y; yy += 40 * s) {
    ctx.beginPath(); ctx.moveTo(x - 110 * s, yy); ctx.lineTo(x + 110 * s, yy); ctx.stroke();
  }
  ctx.fillStyle = zaman === 'gunduz' ? '#3A2E2A' : '#141018';
  ctx.beginPath(); ctx.moveTo(x - 140 * s, y - 900 * s); ctx.lineTo(x, y - 1120 * s); ctx.lineTo(x + 140 * s, y - 900 * s); ctx.closePath(); ctx.fill();
  const cy = y - 720 * s;
  const r = 85 * s;
  const g = ctx.createRadialGradient(x, cy, r * 0.5, x, cy, r * 2.4);
  g.addColorStop(0, hex('#F4E6B0', zaman === 'gece' ? 0.25 : 0.05)); g.addColorStop(1, hex('#F4E6B0', 0));
  ctx.fillStyle = g; ctx.fillRect(x - r * 2.5, cy - r * 2.5, r * 5, r * 5);
  ctx.fillStyle = '#E8DEC0'; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 6 * s; ctx.strokeStyle = '#1A1418'; ctx.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82); ctx.lineTo(x + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    ctx.lineWidth = 4 * s; ctx.stroke();
  }
  const [hs, ms] = String(saat ?? '03:17').split(':').map(Number);
  const ma = ((ms % 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const ha = (((hs % 12) + (ms % 60) / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.lineCap = 'round';
  ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5); ctx.stroke();
  ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(ma) * r * 0.78, cy + Math.sin(ma) * r * 0.78); ctx.stroke();
  ctx.fillStyle = '#1A1418'; ctx.beginPath(); ctx.arc(x, cy, 8 * s, 0, Math.PI * 2); ctx.fill();
  // Kapı
  ctx.fillStyle = '#120C10'; ctx.beginPath(); ctx.moveTo(x - 45 * s, y); ctx.lineTo(x - 45 * s, y - 130 * s);
  ctx.arc(x, y - 130 * s, 45 * s, Math.PI, 0); ctx.lineTo(x + 45 * s, y); ctx.closePath(); ctx.fill();
}

function fener(ctx, x, y, t, guc = 1) {
  const titre = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
  const g = ctx.createRadialGradient(x, y, 5, x, y, 380 * guc);
  g.addColorStop(0, hex('#FFC873', 0.5 * titre)); g.addColorStop(0.3, hex('#F2A24A', 0.18 * titre)); g.addColorStop(1, hex('#F2A24A', 0));
  ctx.fillStyle = g; ctx.fillRect(x - 400 * guc, y - 400 * guc, 800 * guc, 800 * guc);
  ctx.fillStyle = '#1A1210'; ctx.fillRect(x - 6, y + 30, 12, 600);
  ctx.fillStyle = hex('#FFD890', titre); ctx.beginPath(); ctx.roundRect(x - 22, y - 30, 44, 60, 8); ctx.fill();
  ctx.strokeStyle = '#1A1210'; ctx.lineWidth = 5; ctx.stroke();
}

function kuyu(ctx, x, y, s, zaman) {
  const tas = zaman === 'gunduz' ? '#6E665E' : '#2A2830';
  ctx.fillStyle = tas; ctx.beginPath(); ctx.ellipse(x, y, 230 * s, 60 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 230 * s, y - 180 * s, 460 * s, 180 * s);
  ctx.fillStyle = '#05060A'; ctx.beginPath(); ctx.ellipse(x, y - 180 * s, 230 * s, 60 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hex('#000000', 0.4); ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 230 * s, y - 140 * s + k * 40 * s); ctx.lineTo(x + 230 * s, y - 140 * s + k * 40 * s); ctx.stroke(); }
  ctx.fillStyle = zaman === 'gunduz' ? '#4A3426' : '#1E1612';
  ctx.fillRect(x - 210 * s, y - 520 * s, 24 * s, 360 * s); ctx.fillRect(x + 186 * s, y - 520 * s, 24 * s, 360 * s);
  ctx.beginPath(); ctx.moveTo(x - 270 * s, y - 500 * s); ctx.lineTo(x, y - 640 * s); ctx.lineTo(x + 270 * s, y - 500 * s); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 200 * s, y - 470 * s, 400 * s, 16 * s);
  ctx.strokeStyle = '#3A2E22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 462 * s); ctx.lineTo(x, y - 300 * s); ctx.stroke();
  ctx.fillStyle = '#3A2E22'; ctx.fillRect(x - 35 * s, y - 300 * s, 70 * s, 70 * s);
}

function sis(ctx, W, H, t, yogun = 1) {
  for (let k = 0; k < 7; k++) {
    const y = H * (0.45 + k * 0.08);
    const x = ((t * (12 + k * 6) + h(k) * W) % (W + 800)) - 400;
    const g = ctx.createRadialGradient(x, y, 20, x, y, 520);
    g.addColorStop(0, hex('#C8D2DC', 0.13 * yogun)); g.addColorStop(1, hex('#C8D2DC', 0));
    ctx.fillStyle = g; ctx.fillRect(x - 520, y - 520, 1040, 1040);
    const x2 = x - W * 0.6;
    ctx.fillStyle = g; ctx.save(); ctx.translate(-W * 0.6, 0); ctx.fillRect(x - 520, y - 520, 1040, 1040); ctx.restore();
    if (x2 < -2000) break;
  }
  const alt = ctx.createLinearGradient(0, H * 0.55, 0, H);
  alt.addColorStop(0, hex('#B8C4CE', 0)); alt.addColorStop(1, hex('#B8C4CE', 0.22 * yogun));
  ctx.fillStyle = alt; ctx.fillRect(0, H * 0.55, W, H * 0.45);
}

function yagmur(ctx, W, H, t) {
  ctx.strokeStyle = hex('#C8D4E6', 0.35); ctx.lineWidth = 2;
  for (let i = 0; i < 220; i++) {
    const x = (h(i) * W + t * 120) % W;
    const y = (h(i * 2.7) * H + t * 1800) % H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 40); ctx.stroke();
  }
}

function zemin(ctx, W, H, zaman) {
  ctx.fillStyle = zaman === 'gunduz' ? '#4A4840' : '#121218';
  ctx.beginPath(); ctx.moveTo(0, H * 0.62); ctx.quadraticCurveTo(W / 2, H * 0.58, W, H * 0.62); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hex('#000000', 0.25);
  for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.ellipse(h(i) * W, H * 0.64 + h(i * 3) * H * 0.36, 26, 9, 0, 0, Math.PI * 2); ctx.fill(); }
}

function icMekan(ctx, W, H, t, kule) {
  ctx.fillStyle = kule ? '#2E2830' : '#3A2618'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = hex('#000000', 0.4); ctx.lineWidth = 4;
  if (kule) {
    for (let y = 30; y < H; y += 70) for (let x = (y / 70) % 2 ? 0 : 60; x < W; x += 120) ctx.strokeRect(x, y, 120, 70);
    // Dişliler (dönüyor)
    for (const [gx, gy, r, yon] of [[300, 520, 180, 1], [560, 360, 110, -1.6], [760, 600, 140, 1.3]]) {
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(t * 0.25 * yon);
      ctx.fillStyle = '#7A5E36'; ctx.beginPath();
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; const rr = k % 2 ? r : r * 0.86; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#120C08'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#1A140E'; ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Pencereden giren ışık ve toz
    ctx.fillStyle = hex('#C8D8F0', 0.14);
    ctx.beginPath(); ctx.moveTo(880, 120); ctx.lineTo(980, 120); ctx.lineTo(600, 1300); ctx.lineTo(300, 1300); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = hex('#FFFFFF', 0.25 * h(i));
      ctx.fillRect(400 + h(i) * 400 + Math.sin(t + i) * 10, (h(i * 5) * 1100 + t * 8) % 1200 + 100, 3, 3);
    }
  } else {
    for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    // Pencere (dışarıda ay ve sis)
    ctx.fillStyle = '#0E1828'; ctx.fillRect(620, 260, 300, 380);
    ctx.fillStyle = '#E9E5D2'; ctx.beginPath(); ctx.arc(820, 340, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hex('#C8D2DC', 0.2 + Math.sin(t * 0.5) * 0.05); ctx.fillRect(620, 480, 300, 160);
    ctx.strokeStyle = '#1E120A'; ctx.lineWidth = 16; ctx.strokeRect(620, 260, 300, 380);
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(770, 260); ctx.lineTo(770, 640); ctx.moveTo(620, 450); ctx.lineTo(920, 450); ctx.stroke();
    // Raf, sandık
    ctx.fillStyle = '#24160C'; ctx.fillRect(80, 420, 380, 22);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#6A4A2A', '#3A4A5A', '#7A2E24', '#5E7A4A'][k]; ctx.fillRect(110 + k * 85, 340, 50, 80); }
    ctx.fillStyle = '#4A2E18'; ctx.fillRect(90, 820, 420, 220); ctx.fillStyle = '#5A3A20'; ctx.fillRect(80, 790, 440, 50);
    ctx.fillStyle = '#B8893B'; ctx.fillRect(280, 860, 40, 50);
    // Gaz lambası ışığı
    const titre = 0.85 + Math.sin(t * 8) * 0.06;
    const g = ctx.createRadialGradient(780, 820, 10, 780, 820, 900);
    g.addColorStop(0, hex('#FFC873', 0.45 * titre)); g.addColorStop(1, hex('#FFC873', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = hex('#FFE0A0', titre); ctx.beginPath(); ctx.ellipse(780, 800, 26, 40, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A1A10'; ctx.fillRect(740, 840, 80, 24);
  }
  ctx.fillStyle = kule ? '#141016' : '#24160C'; ctx.fillRect(0, H * 0.66, W, H * 0.34);
}

// Mekânı tam tuvale çizer. o: { t, zaman, efektler: [], saat, kamera (0-1 sahne ilerleyişi) }
export function mekan(ctx, ad, o = {}) {
  const { W = 1080, H = 1920, t = 0, zaman = 'gece', efektler = [], saat = '03:17', kamera = 0 } = o;
  ctx.save();
  // Yavaş kamera yaklaşması
  const z = 1 + eo(cl(kamera)) * 0.06;
  ctx.translate(W / 2, H * 0.45); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.45);
  if (ad === 'ev-ic' || ad === 'kule-ic') {
    icMekan(ctx, W, H, t, ad === 'kule-ic');
  } else {
    gokyuzu(ctx, W, H, zaman, t);
    daglar(ctx, W, H, zaman);
    const camRenk = zaman === 'gunduz' ? '#2E3A34' : '#060A10';
    for (let i = 0; i < 9; i++) cam1(ctx, h(i * 4.1) * W, H * (0.5 + h(i) * 0.06), 0.6 + h(i * 2) * 0.5, camRenk);
    zemin(ctx, W, H, zaman);
    if (ad === 'meydan') {
      ev(ctx, -40, H * 0.63, 300, 300, zaman, t, 3);
      ev(ctx, 800, H * 0.63, 320, 320, zaman, t, 7);
      saatKulesi(ctx, W / 2, H * 0.63, 0.9, saat, zaman, t);
      if (zaman !== 'gunduz') fener(ctx, 250, H * 0.42, t, 0.8);
    } else if (ad === 'kuyu') {
      ev(ctx, -80, H * 0.6, 260, 260, zaman, t, 11);
      kuyu(ctx, W / 2, H * 0.66, 1.1, zaman);
    } else if (ad === 'yol') {
      ctx.fillStyle = zaman === 'gunduz' ? '#6A6050' : '#1C1A1E';
      ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.6); ctx.lineTo(W * 0.58, H * 0.6); ctx.lineTo(W * 1.1, H); ctx.lineTo(-W * 0.1, H); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 6; k++) {
        const p = k / 6;
        ctx.fillStyle = '#2A1E16';
        ctx.fillRect(W * (0.38 - p * 0.42), H * (0.6 + p * 0.4) - 120 * (0.4 + p), 14 * (0.4 + p), 120 * (0.4 + p));
        ctx.fillRect(W * (0.62 + p * 0.42), H * (0.6 + p * 0.4) - 120 * (0.4 + p), 14 * (0.4 + p), 120 * (0.4 + p));
      }
      ev(ctx, W * 0.35, H * 0.6, 140, 120, zaman, t, 5);
      if (zaman !== 'gunduz') fener(ctx, W * 0.72, H * 0.45, t, 0.6);
    } else if (ad === 'orman') {
      for (let i = 0; i < 14; i++) cam1(ctx, h(i * 7.7) * W, H * (0.62 + h(i * 1.3) * 0.12), 1.2 + h(i) * 1.2, zaman === 'gunduz' ? '#1E2A24' : '#04070C');
    }
  }
  if (efektler.includes('titreyen-isik') && Math.sin(t * 13) > 0.6) { ctx.fillStyle = hex('#000000', 0.35); ctx.fillRect(0, 0, W, H); }
  if (ad !== 'ev-ic' && ad !== 'kule-ic') sis(ctx, W, H, t, efektler.includes('sis') ? 2 : 1);
  if (efektler.includes('yagmur')) yagmur(ctx, W, H, t);
  ctx.restore();
  if (efektler.includes('simsek')) {
    const f = (t % 6) < 0.12 || ((t % 6) > 0.22 && (t % 6) < 0.3);
    if (f) { ctx.fillStyle = hex('#E8F0FF', 0.55); ctx.fillRect(0, 0, W, H); }
  }
  // Kenar kararması
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, hex('#000000', 0)); v.addColorStop(1, hex('#000000', 0.55));
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// Konuşma sırasında ağız açıklığı (kelime zamanlarından, hece ritmiyle).
export function agizAcikligi(words, t) {
  const w = words.find((x) => t >= x.t && t < x.t + x.d);
  if (!w) return 0;
  const u = t - w.t;
  const hece = Math.max(1, Math.round((w.text ?? w.w ?? '').replace(/[^aeıioöuüâîûAEIİOÖUÜ]/g, '').length));
  const f = (hece / Math.max(0.15, w.d)) * Math.PI;
  return 0.25 + 0.75 * Math.abs(Math.sin(u * f));
}

export { pr, eo, cl, h };
