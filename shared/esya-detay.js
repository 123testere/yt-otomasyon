// Anlatımda geçen gündelik eşyalar ve takılar (kullanıcı kuralı 2026-11-25: söylenen nesne ekranda görünür).
// Yakın planda da net dursun diye doku, parlama ve kenar ayrıntısıyla çizilir.
const HAT = '#0C0A10';
export const IKI_EL = ['testi', 'kova', 'sepet', 'tepsi', 'kase'];
export const DETAY_ESYA = [...IKI_EL, 'mektup', 'kese', 'sise', 'kitap', 'ekmek', 'cicek'];
export const TAKILAR = ['bilezik', 'yarim-bilezik', 'kelepce', 'yuzuk', 'kolye'];
export const YER_NESNE = [...DETAY_ESYA, 'su-birikintisi', 'su-damlasi', 'kirik-testi', 'bilezik', 'yarim-bilezik'];

// 2 sayı: çizgi, 6 sayı: eğri
const yol = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => { if (!i) ctx.moveTo(...p); else if (p.length === 2) ctx.lineTo(...p); else ctx.bezierCurveTo(...p); }); };
const boya = (ctx, renk, w = 5) => { ctx.fillStyle = renk; ctx.fill(); ctx.lineWidth = w; ctx.strokeStyle = HAT; ctx.lineJoin = 'round'; ctx.stroke(); };
const gecis = (ctx, x0, x1, a, b, c) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(0.45, b); g.addColorStop(1, c); return g; };

// (0,0) = eşyanın tabanı; yukarı eksi y
function nesne(ctx, ad, t, seed) {
  ctx.lineCap = 'round';
  if (ad === 'testi') {
    ctx.lineWidth = 15; ctx.strokeStyle = HAT; ctx.beginPath(); ctx.moveTo(26, -118); ctx.bezierCurveTo(78, -120, 74, -66, 46, -58); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = '#A8592C'; ctx.stroke();
    yol(ctx, [[-26, 0], [-66, -30, -62, -86, -22, -104], [-22, -128], [-32, -138], [32, -138], [22, -128], [22, -104], [62, -86, 66, -30, 26, 0]]); ctx.closePath();
    boya(ctx, gecis(ctx, -60, 60, '#8A4520', '#D08A4E', '#7A3A1A'));
    ctx.lineWidth = 4; ctx.strokeStyle = '#F0D8A8'; ctx.beginPath(); ctx.moveTo(-48, -58);
    for (let k = 0; k <= 8; k++) ctx.lineTo(-48 + k * 12, -58 + (k % 2 ? 7 : -5));
    ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-46, -38); ctx.quadraticCurveTo(0, -28, 46, -38); ctx.stroke();
    ctx.fillStyle = '#3A86B8'; ctx.beginPath(); ctx.ellipse(0, -137 + Math.sin(t * 6 + seed) * 1.5, 25, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-26, -76, 7, 18, 0.2, 0, 7); ctx.fill();
  } else if (ad === 'kova') {
    ctx.lineWidth = 6; ctx.strokeStyle = HAT; ctx.beginPath(); ctx.arc(0, -80, 46, Math.PI, 0); ctx.stroke();
    yol(ctx, [[-36, 0], [-48, -82], [48, -82], [36, 0]]); ctx.closePath(); boya(ctx, gecis(ctx, -48, 48, '#5A3A1E', '#9A6A3A', '#4A2E18'));
    ctx.lineWidth = 7; ctx.strokeStyle = '#8A8A94';
    for (const [y, x] of [[-18, 38], [-62, 45]]) { ctx.beginPath(); ctx.moveTo(-x, y); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -82, 46, 9, 0, 0, 7); boya(ctx, '#3A86B8', 4);
  } else if (ad === 'sepet') {
    ctx.lineWidth = 8; ctx.strokeStyle = '#7A5426'; ctx.beginPath(); ctx.arc(0, -58, 50, Math.PI, 0); ctx.stroke();
    for (const [x, c] of [[-26, '#C8403A'], [0, '#D8A83A'], [26, '#6A9A3A']]) { ctx.beginPath(); ctx.arc(x, -64, 19, 0, 7); boya(ctx, c, 4); }
    yol(ctx, [[-42, 0], [-58, -60], [58, -60], [42, 0]]); ctx.closePath(); boya(ctx, '#B8843E');
    ctx.lineWidth = 3; ctx.strokeStyle = '#6A4418';
    for (let y = -48; y < -6; y += 14) for (let x = -44; x < 36; x += 16) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 8); ctx.stroke(); }
  } else if (ad === 'tepsi') {
    for (const x of [-38, 38]) { yol(ctx, [[x - 14, -12], [x - 18, -48], [x + 18, -48], [x + 14, -12]]); ctx.closePath(); boya(ctx, '#C8A04A', 4); }
    ctx.beginPath(); ctx.ellipse(0, -26, 20, 14, 0, 0, 7); boya(ctx, '#C88A4A', 4);
    ctx.beginPath(); ctx.roundRect(-84, -14, 168, 14, 7); boya(ctx, '#A8A8B4');
  } else if (ad === 'kase') {
    ctx.beginPath(); ctx.arc(0, -46, 46, 0, Math.PI); ctx.closePath(); boya(ctx, gecis(ctx, -46, 46, '#6A4424', '#A8764A', '#5A3618'));
    ctx.beginPath(); ctx.ellipse(0, -46, 45, 9, 0, 0, 7); boya(ctx, '#D8A860', 4);
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 4;
    for (const x of [-14, 12]) { ctx.beginPath(); ctx.moveTo(x, -60); ctx.quadraticCurveTo(x + Math.sin(t * 2 + x) * 14, -82, x, -104); ctx.stroke(); }
  } else if (ad === 'mektup') {
    ctx.beginPath(); ctx.roundRect(-46, -66, 92, 62, 4); boya(ctx, '#EADCB4');
    ctx.lineWidth = 4; ctx.strokeStyle = '#8A7444'; ctx.beginPath(); ctx.moveTo(-44, -64); ctx.lineTo(0, -30); ctx.lineTo(44, -64); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -30, 14, 0, 7); boya(ctx, '#A8202C', 4);
    ctx.fillStyle = '#E86A6A'; ctx.beginPath(); ctx.arc(-4, -34, 4, 0, 7); ctx.fill();
  } else if (ad === 'kese') {
    yol(ctx, [[-14, -62], [-60, -50, -56, 0, 0, 0], [56, 0, 60, -50, 14, -62], [24, -84], [-24, -84]]); ctx.closePath(); boya(ctx, '#8A5A2E');
    ctx.lineWidth = 7; ctx.strokeStyle = '#E2B23C'; ctx.beginPath(); ctx.moveTo(-18, -62); ctx.lineTo(18, -62); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -28, 13, 0, 7); boya(ctx, '#E2B23C', 3);
  } else if (ad === 'sise') {
    yol(ctx, [[-24, 0], [-24, -46], [-9, -64], [-9, -88], [9, -88], [9, -64], [24, -46], [24, 0]]); ctx.closePath(); boya(ctx, 'rgba(120,190,130,.85)');
    ctx.fillStyle = '#3A7A3A'; ctx.fillRect(-20, -38 + Math.sin(t * 5) * 1.5, 40, 35);
    ctx.beginPath(); ctx.roundRect(-11, -102, 22, 18, 4); boya(ctx, '#8A5A2E', 4);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-16, -42, 6, 30);
  } else if (ad === 'kitap') {
    ctx.beginPath(); ctx.roundRect(-36, -92, 72, 92, 5); boya(ctx, '#6A2430');
    ctx.fillStyle = '#EADCB4'; ctx.fillRect(26, -87, 8, 82);
    ctx.lineWidth = 4; ctx.strokeStyle = '#E2B23C'; ctx.strokeRect(-26, -82, 44, 72);
    ctx.beginPath(); ctx.arc(-4, -46, 10, 0, 7); ctx.stroke();
  } else if (ad === 'ekmek') {
    ctx.beginPath(); ctx.ellipse(0, -24, 52, 24, 0, 0, 7); boya(ctx, '#C88A4A');
    ctx.lineWidth = 5; ctx.strokeStyle = '#F0D090';
    for (const x of [-22, 0, 22]) { ctx.beginPath(); ctx.moveTo(x - 6, -36); ctx.lineTo(x + 6, -16); ctx.stroke(); }
  } else if (ad === 'cicek') {
    ctx.lineWidth = 6; ctx.strokeStyle = '#3A7A2E'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -34, 0, -66); ctx.stroke();
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(Math.cos(k * 1.05) * 16, -76 + Math.sin(k * 1.05) * 16, 11, 0, 7); boya(ctx, '#E86A8A', 3); }
    ctx.beginPath(); ctx.arc(0, -76, 9, 0, 7); boya(ctx, '#F2C23A', 3);
  } else return false;
  return true;
}

// Elde: iki elle taşınan eşya elin biraz altına iner (eller gövdesinde kalır); küçükler elden yukarı durur
export function esyaCizDetay(ctx, esya, el, t, seed) {
  if (!DETAY_ESYA.includes(esya)) return false;
  ctx.save();
  ctx.translate(el[0] + (IKI_EL.includes(esya) ? 6 : 4), el[1] + (esya === 'tepsi' ? 4 : IKI_EL.includes(esya) ? 56 : 18));
  nesne(ctx, esya, t, seed);
  ctx.restore();
  // Eşyayı tutan el
  ctx.beginPath(); ctx.arc(el[0], el[1], 13, 0, 7); ctx.fillStyle = '#F3EAD7'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = HAT; ctx.stroke();
  return true;
}

// Bakır halka: kola dik bant, dövme desen ve gezen parlama; yarım olanın bir ucu kırıktır
function bilezik(ctx, yarim, t) {
  const g = ctx.createLinearGradient(-20, 0, 20, 0);
  g.addColorStop(0, '#7A3A14'); g.addColorStop(0.4, '#F0A45A'); g.addColorStop(0.55, '#FFD49A'); g.addColorStop(1, '#8A441A');
  yol(ctx, yarim ? [[-20, -13], [6, -13], [13, -8], [4, -3], [12, 3], [5, 8], [10, 13], [-20, 13]] : [[-20, -12], [20, -12], [20, 12], [-20, 12]]); ctx.closePath(); boya(ctx, g, 4);
  ctx.lineWidth = 2; ctx.strokeStyle = '#5A2A0E';
  for (let x = -15; x < (yarim ? 0 : 16); x += 7) { ctx.beginPath(); ctx.moveTo(x, -7); ctx.lineTo(x + 4, 0); ctx.lineTo(x, 7); ctx.stroke(); }
  const par = Math.max(0, Math.sin(t * 2.4)) ** 6;
  if (par > 0.02) {
    ctx.strokeStyle = `rgba(255,250,220,${par * 0.5})`; ctx.lineWidth = 2.5;
    for (const a of [0, 0.785, 1.57, 2.356]) { ctx.beginPath(); ctx.moveTo(-6 - Math.cos(a) * 14, -8 - Math.sin(a) * 14); ctx.lineTo(-6 + Math.cos(a) * 14, -8 + Math.sin(a) * 14); ctx.stroke(); }
  }
}

export function takiCiz(ctx, ad, { dirsek, el, boyun, t = 0, seed = 1 }) {
  const aci = Math.atan2(el[1] - dirsek[1], el[0] - dirsek[0]) - Math.PI / 2;
  const at = (k) => [dirsek[0] + (el[0] - dirsek[0]) * k, dirsek[1] + (el[1] - dirsek[1]) * k];
  ctx.save();
  if (ad === 'bilezik' || ad === 'yarim-bilezik') {
    ctx.translate(...at(0.75)); ctx.rotate(aci); bilezik(ctx, ad !== 'bilezik', t + seed);
  } else if (ad === 'kelepce') {
    // Kırık zincirli demir halka: üç bakla sarkar, sonuncusu kopuk
    ctx.translate(...at(0.75));
    ctx.save(); ctx.rotate(aci);
    ctx.beginPath(); ctx.roundRect(-18, -13, 36, 26, 5); boya(ctx, gecis(ctx, -18, 18, '#3A3A44', '#B8B8C4', '#44444E'), 4);
    ctx.fillStyle = '#2A2A32'; for (const x of [-11, 11]) { ctx.beginPath(); ctx.arc(x, 0, 3.2, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.rotate(Math.sin(t * 3 + seed) * 0.18);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(0, 22 + k * 19, k % 2 ? 4 : 8, 12, 0, k === 2 ? 2.2 : 0, k === 2 ? 7.2 : 7);
      ctx.lineWidth = 8; ctx.strokeStyle = HAT; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = '#A0A0AC'; ctx.stroke();
    }
  } else if (ad === 'yuzuk') {
    ctx.translate(...el); ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.lineWidth = 5; ctx.strokeStyle = '#E2B23C'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -9, 5, 0, 7); boya(ctx, '#C8203A', 2);
  } else if (ad === 'kolye') {
    ctx.beginPath(); ctx.arc(boyun[0], boyun[1] + 8, 24, 0.2, Math.PI - 0.2); ctx.lineWidth = 4; ctx.strokeStyle = '#E2B23C'; ctx.stroke();
    ctx.beginPath(); ctx.arc(boyun[0], boyun[1] + 36, 8, 0, 7); boya(ctx, '#3A8AC8', 3);
  }
  ctx.restore();
}

// Yerdeki nesne ((0,0) = zemin); u: göründükten sonra geçen saniye
export function yerNesneCiz(ctx, tip, u, seed = 1) {
  if (tip === 'su-birikintisi') {
    const k = Math.max(0, Math.min(1, u / 0.8));
    ctx.fillStyle = 'rgba(90,160,205,.72)'; ctx.beginPath(); ctx.ellipse(0, 4, 120 * k, 17 * k, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(88 * k, 9, 46 * k, 9 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(225,244,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-22, 1, 60 * k, 7 * k, 0, 3.3, 5.4); ctx.stroke();
    if (u < 0.9) { // dökülme anı: sıçrayan damlalar
      ctx.fillStyle = 'rgba(160,215,245,.9)';
      for (let i = 0; i < 12; i++) {
        const a = -0.4 - (i / 12) * 2.4; const v = 150 + ((i * 53) % 90);
        const y = Math.sin(a) * v * u + 330 * u * u;
        if (y < 0) { ctx.beginPath(); ctx.arc(Math.cos(a) * v * u, y, 6, 0, 7); ctx.fill(); }
      }
    }
  } else if (tip === 'su-damlasi') {
    for (const [x, r] of [[-70, 14], [-18, 20], [40, 12], [84, 17]]) {
      ctx.fillStyle = 'rgba(100,170,215,.8)'; ctx.beginPath(); ctx.ellipse(x, 2, r * 1.5, r * 0.42, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(240,250,255,.9)'; ctx.beginPath(); ctx.ellipse(x - r * 0.4, 0, r * 0.35, r * 0.1, 0, 0, 7); ctx.fill();
    }
  } else if (tip === 'kirik-testi') {
    for (const [x, a, r] of [[-50, 0.3, 34], [6, -0.2, 44], [62, 0.7, 26]]) {
      ctx.save(); ctx.translate(x, -4); ctx.rotate(a); ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0.2); ctx.lineTo(r * 0.3, -r * 0.35); ctx.closePath(); boya(ctx, '#B0683A', 5); ctx.restore();
    }
  } else if (tip === 'bilezik' || tip === 'yarim-bilezik') {
    ctx.translate(0, -12); bilezik(ctx, tip !== 'bilezik', u + seed);
  } else nesne(ctx, tip, u, seed);
}
