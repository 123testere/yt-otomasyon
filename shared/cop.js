// Çöp adam karakterler (dizi kanalı, "cop" stili): tam boy, krem gövde + koyu hat (gece sahnesinde seçilir).
// Pozlar eklem açılarıyla çizilir; konuşurken kol hareket eder, ağız oynar, göz kırpar.
// Karakter aksesuarlarla tanınır: saç, başörtüsü, şapka/miğfer/taç, pelerin, sakal, göz bandı, yara izi, önlük, kuşak.
// Eşyalar: kılıç, kalkan, tahta kılıç, meşale, fener, baston, bilekte zincir.
import { KAS, cl, elips, eo, h, kirpma, sekil, ton } from './dizi.js';

export const POZLAR = ['dur', 'yuru', 'kos', 'isaret', 'korku', 'dusun', 'el-salla', 'omuz', 'eller-belde', 'egil',
  'kilic-kaldir', 'kilic-savur', 'saldir', 'blok', 'darbe', 'dus', 'yerde', 'kalk', 'zincirli', 'diz-cok', 'zafer', 'tasi',
  'kilic-hazir', 'kilic-indir', 'it', 'kaldir'];
export const ESYALAR = ['kilic', 'kalkan', 'kilic+kalkan', 'tahta-kilic', 'mesale', 'fener', 'baston', 'tas', 'oyun-kolu', 'kupa', 'disket', 'para', 'canta', 'anahtar'];

const COP = { bas: 58, kalca: -215, omuz: -372, kol1: 92, kol2: 88, bacak1: 110, bacak2: 108 };
const GOVDE = '#F3EAD7';
const HAT = '#0C0A10';

function uzuv(ctx, pts, w, renk) {
  for (const [lw, c] of [[w + 9, HAT], [w, renk]]) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
}

// Açılar radyan: 0 = aşağı, + = ileri (karakterin baktığı yön). İkinci açı dirsek/diz bükümü.
function kolNokta(o, a1, a2) {
  const e = [o[0] + Math.sin(a1) * COP.kol1, o[1] + Math.cos(a1) * COP.kol1];
  return [o, e, [e[0] + Math.sin(a1 + a2) * COP.kol2, e[1] + Math.cos(a1 + a2) * COP.kol2]];
}
function bacakNokta(o, a1, a2) {
  const d = [o[0] + Math.sin(a1) * COP.bacak1, o[1] + Math.cos(a1) * COP.bacak1];
  return [o, d, [d[0] + Math.sin(a1 - a2) * COP.bacak2, d[1] + Math.cos(a1 - a2) * COP.bacak2]];
}

// pozU: bu poza geçeli kaç saniye oldu (düşme/kalkma/savurma geçişleri için)
function pozAcilari(ad, t, seed, konusuyor, yasli, pozU = 9) {
  const s = Math.sin;
  const nefes = s(t * 1.6 + seed) * 0.03;
  let r = { on: [0.12 + nefes, -0.15], arka: [-0.12 - nefes, -0.15], onB: [0.06, 0], arkaB: [-0.06, 0], egim: yasli ? 0.12 : 0, zipla: 0, yatis: 0 };
  if (ad === 'yuru' || ad === 'kos' || ad === 'tasi') {
    const hiz = ad === 'kos' ? 11 : ad === 'tasi' ? 4.5 : 6.5;
    const genlik = ad === 'kos' ? 0.75 : 0.4;
    const f = s(t * hiz + seed);
    r = {
      on: [f * genlik, ad === 'kos' ? -1.4 : -0.3], arka: [-f * genlik, ad === 'kos' ? -1.4 : -0.3],
      onB: [-f * genlik, Math.max(0, f) * 0.9], arkaB: [f * genlik, Math.max(0, -f) * 0.9],
      egim: (ad === 'kos' ? 0.22 : ad === 'tasi' ? 0.3 : 0.05) + (yasli ? 0.12 : 0),
      zipla: Math.abs(Math.cos(t * hiz + seed)) * (ad === 'kos' ? 16 : 7), yatis: 0,
    };
    if (ad === 'tasi') { r.on = [2.7, 0.6]; r.arka = [2.6, 0.7]; } // omuzda taş
  } else if (ad === 'isaret') {
    r.on = [2.1 + s(t * 2) * 0.03, 0.05];
  } else if (ad === 'korku') {
    const tit = s(t * 40) * 0.04;
    r = { ...r, on: [1.9 + tit, 1.05], arka: [-1.9 - tit, -1.05], onB: [0.25, 0.5], arkaB: [-0.2, 0.45], egim: -0.1, zipla: -14 };
  } else if (ad === 'dusun') {
    r.on = [0.9, 2.68]; r.arka = [0.45, 1.5];
  } else if (ad === 'el-salla') {
    r.on = [1.9, 0.75 + s(t * 9) * 0.4];
  } else if (ad === 'omuz') {
    r.on = [0.9, 1.9]; r.arka = [-0.9, -1.9]; r.zipla = -6 * Math.abs(s(t * 2));
  } else if (ad === 'eller-belde') {
    r.on = [0.7, -1.15]; r.arka = [-0.7, 1.15];
  } else if (ad === 'egil') {
    r.egim = 0.5; r.on = [0.6, 0]; r.arka = [0.4, 0];
  } else if (ad === 'kilic-kaldir') {
    const titre = s(t * 30) * 0.02;
    r = { ...r, on: [2.55 + titre, 0.75], arka: [2.4 + titre, 0.85], onB: [0.3, 0.1], arkaB: [-0.35, 0.05], egim: -0.12 };
  } else if (ad === 'kaldir') {
    // Yerden ağır bir şey kaldırmak (zemin kapağı, sandık): dizler kırık, sırt düz, iki el aşağıda tutar; zorlanırken titrer
    const z = s(t * 8 + seed) * 0.03;
    r = { ...r, on: [0.45 + z, 0.15], arka: [0.4 - z, 0.15], onB: [0.95, 1.35], arkaB: [-0.25, 1.2], egim: 0.3, zipla: -62 };
  } else if (ad === 'it') {
    // Ağır bir şeyi (kapı, fıçı) itmek: iki kol önde düz, gövde öne eğik, arka bacak gergin; zorlanırken hafif titrer
    const z = s(t * 7 + seed) * 0.04;
    r = { ...r, on: [1.45 + z, -0.12], arka: [1.38 - z, -0.08], onB: [0.18, 0.12], arkaB: [-0.6, 0.12], egim: 0.42, zipla: 0 };
  } else if (ad === 'kilic-hazir') {
    // Muhafız/dövüşçü duruşu: kılıç önde çapraz yukarı, dizler kırık, hafif yaylanma
    const b = s(t * 2.4 + seed) * 0.05;
    r = { ...r, on: [1.3 + b, 0.6], arka: [0.85 + b, 1.0], onB: [0.45, 0.35], arkaB: [-0.42, 0.3], egim: 0.1, zipla: -16 + s(t * 2.4 + seed) * 3 };
  } else if (ad === 'kilic-indir') {
    // Tek seferlik vuruş: kalkık kılıç 0,18 sn'de hızlanarak öne-aşağı iner, çarpmada hafifçe geri teper ve orada kalır
    const x = cl(pozU / 0.18);
    const geri = pozU > 0.18 ? Math.sin((pozU - 0.18) * 22) * Math.exp(-(pozU - 0.18) * 9) * 0.08 : 0;
    const k = x * x - geri;
    // Bitişte kılıç öne, hafif aşağı bakar (rakibin kılıcına/kalkanına çarpacak yükseklikte)
    r = { ...r, on: [2.65 - k * 1.5, 0.15], arka: [-0.6, -0.6], onB: [0.25 + 0.4 * k, 0.3], arkaB: [-0.55, 0.1], egim: 0.05 + 0.22 * k, zipla: -12 * k };
  } else if (ad === 'kilic-savur') {
    // Sürekli savurma: yukarıdan aşağı hızlı darbe, yavaş geri kaldırma
    const ph = (t * 1.6 + seed) % 1;
    const a = ph < 0.25 ? 2.7 - eo(ph / 0.25) * 2.2 : 0.5 + eo((ph - 0.25) / 0.75) * 2.2;
    r = { ...r, on: [a, 0.15], arka: [-0.5, -0.7], onB: [0.45, 0.25], arkaB: [-0.45, 0.05], egim: 0.12 + (ph < 0.25 ? 0.1 : 0) };
  } else if (ad === 'saldir') {
    r = { ...r, on: [1.55, 0.05], arka: [-0.8, -0.6], onB: [0.55, 0.35], arkaB: [-0.65, 0], egim: 0.28 };
  } else if (ad === 'blok') {
    r = { ...r, on: [1.25, 1.35], arka: [-0.3, -0.8], onB: [0.3, 0.45], arkaB: [-0.35, 0.3], egim: -0.05, zipla: -18 };
  } else if (ad === 'darbe') {
    const geri = 1 - eo(cl(pozU / 0.6));
    r = { ...r, on: [-0.7, -0.5], arka: [-1.1, -0.6], onB: [0.35, 0.3], arkaB: [-0.2, 0.2], egim: -0.35 * (0.5 + geri * 0.5), zipla: 10 * geri };
  } else if (ad === 'dus' || ad === 'yerde' || ad === 'kalk') {
    const y = ad === 'yerde' ? 1 : ad === 'dus' ? eo(cl(pozU / 0.55)) : 1 - eo(cl(pozU / 0.9));
    r = { ...r, on: [1.4 * y + 0.1, -0.3], arka: [-1.6 * y, 0.2], onB: [0.15 + 0.3 * y, 0.2 * y], arkaB: [-0.1, 0.5 * y], yatis: y };
  } else if (ad === 'zincirli') {
    r.on = [0.55, 1.25]; r.arka = [0.45, 1.35]; r.egim = 0.08 + (yasli ? 0.1 : 0);
  } else if (ad === 'diz-cok') {
    r = { ...r, on: [0.2, -0.2], arka: [-0.2, -0.2], onB: [1.45, 1.45], arkaB: [0.15, 1.65], egim: 0.12, zipla: -96 };
  } else if (ad === 'zafer') {
    r = { ...r, on: [2.55, -0.25 + s(t * 6) * 0.1], arka: [-2.55, 0.25 - s(t * 6) * 0.1], zipla: Math.abs(s(t * 5)) * 10 };
  }
  // Konuşurken anlatır gibi el hareketi (kol başka pozda meşgul değilse)
  if (konusuyor && ['dur', 'eller-belde', 'egil'].includes(ad)) r.on = [0.9 + s(t * 3.2 + seed) * 0.35, 1.2 + s(t * 4.1) * 0.3];
  return r;
}

// --- Yumuşak poz geçişi -------------------------------------------------------------------------
// Karakter bir pozdan diğerine anında atlamaz: eklem açıları GECIS_SN içinde, hafif bir taşmayla
// (hedefi biraz geçip yerine oturarak) önceki pozdan yenisine kayar. Görünüş değişmez, yalnızca hareket.
// Kendi geçiş animasyonu olan pozlar (darbe, düşme, kalkma) ve ani olması gereken çarpma hariç.
export const GECIS_SN = 0.3;
const GECIS_POZ = { 'kilic-kaldir': 0.5, 'kilic-hazir': 0.4 };
export const gecisSuresi = (ad) => GECIS_POZ[ad] ?? GECIS_SN;
const GECISSIZ = ['darbe', 'dus', 'yerde', 'kalk', 'kilic-indir'];
const tasma = (x) => { const c = 1.4, y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; }; // 0→1, ~%6 taşar
const kar = (a, b, k) => a + (b - a) * k;

export function pozKaristir(onceki, yeni, k) {
  const cift = (ad) => [kar(onceki[ad][0], yeni[ad][0], k), kar(onceki[ad][1], yeni[ad][1], k)];
  return {
    on: cift('on'), arka: cift('arka'), onB: cift('onB'), arkaB: cift('arkaB'),
    egim: kar(onceki.egim, yeni.egim, k), zipla: kar(onceki.zipla, yeni.zipla, k), yatis: kar(onceki.yatis, yeni.yatis, k),
  };
}

// gecis: { poz: önceki poz, u: poz değişeli kaç saniye oldu }. Geçiş bittiyse ya da tanımsızsa yeni poz aynen döner.
export function gecisliPoz(ad, gecis, t, seed, konusuyor, yasli, pozU) {
  const yeni = pozAcilari(ad, t, seed, konusuyor, yasli, pozU);
  const sure = gecisSuresi(ad);
  if (!gecis || gecis.poz === ad || !(gecis.u >= 0 && gecis.u < sure) || GECISSIZ.includes(ad) || GECISSIZ.includes(gecis.poz)) return yeni;
  return pozKaristir(pozAcilari(gecis.poz, t, seed, konusuyor, yasli, 9), yeni, tasma(gecis.u / sure));
}

function sacVeSapka(ctx, def, bx, by) {
  const sac = def.sac ?? '#2A1D16';
  if (['kisa', 'atkuyrugu', 'uzun', 'topuz', 'orgu'].includes(def.sacStil)) {
    sekil(ctx, [[bx - 58, by - 4], [bx - 52, by - 40], [bx - 20, by - 60], [bx + 25, by - 60], [bx + 55, by - 36], [bx + 58, by - 8], [bx + 30, by - 34], [bx - 10, by - 30], [bx - 40, by - 20]], { fill: sac, w: 5 });
    if (def.sacStil === 'topuz') sekil(ctx, elips(bx - 10, by - 72, 26, 20, 12), { fill: sac, w: 5 });
  } else if (def.sacStil === 'dagnik') {
    sekil(ctx, [[bx - 60, by - 2], [bx - 72, by - 40], [bx - 48, by - 52], [bx - 52, by - 82], [bx - 18, by - 70], [bx, by - 96], [bx + 20, by - 68], [bx + 52, by - 84], [bx + 50, by - 50], [bx + 72, by - 40], [bx + 58, by - 4], [bx + 30, by - 36], [bx - 20, by - 36]], { fill: sac, w: 5 });
  }
  const sapka = def.sapka;
  if (sapka === 'kasket') {
    sekil(ctx, [[bx - 62, by - 20], [bx - 56, by - 56], [bx - 10, by - 72], [bx + 40, by - 64], [bx + 62, by - 30]], { fill: def.sapkaRenk ?? '#3A3A3A', w: 5 });
    sekil(ctx, [[bx - 10, by - 26], [bx + 50, by - 30], [bx + 98, by - 14], [bx + 60, by - 8]], { fill: ton(def.sapkaRenk ?? '#3A3A3A', 0.7), w: 4 });
  } else if (sapka === 'migfer') {
    const r = def.sapkaRenk ?? '#7A7468';
    sekil(ctx, [[bx - 66, by + 6], [bx - 64, by - 40], [bx - 30, by - 70], [bx + 30, by - 70], [bx + 64, by - 40], [bx + 66, by + 6], [bx + 40, by - 6], [bx - 40, by - 6]], { fill: r, w: 6 });
    ctx.fillStyle = HAT; ctx.fillRect(bx + 4, by - 6, 10, 30);
    if (def.boynuz !== false) {
      for (const sx of [-1, 1]) sekil(ctx, [[bx + sx * 50, by - 52], [bx + sx * 96, by - 80], [bx + sx * 104, by - 128], [bx + sx * 80, by - 92], [bx + sx * 40, by - 66]], { fill: '#E8DCC0', w: 5 });
    }
  } else if (sapka === 'tac') {
    sekil(ctx, [[bx - 48, by - 44], [bx - 50, by - 92], [bx - 26, by - 64], [bx, by - 102], [bx + 26, by - 64], [bx + 50, by - 92], [bx + 48, by - 44]], { fill: '#E2B23C', w: 5 });
    ctx.fillStyle = '#B4283A'; ctx.beginPath(); ctx.arc(bx, by - 58, 7, 0, Math.PI * 2); ctx.fill();
  } else if (sapka === 'baslik') {
    sekil(ctx, [[bx - 72, by + 40], [bx - 74, by - 30], [bx - 30, by - 80], [bx + 30, by - 80], [bx + 66, by - 40], [bx + 50, by - 20], [bx + 20, by - 50], [bx - 30, by - 44], [bx - 50, by + 10]], { fill: def.sapkaRenk ?? '#141418', w: 6 });
  }
  if (def.aksesuar === 'bere') {
    sekil(ctx, [[bx - 60, by - 18], [bx - 50, by - 60], [bx, by - 80], [bx + 50, by - 60], [bx + 60, by - 18]], { fill: def.renk ?? '#7A2E24', w: 5 });
    ctx.fillStyle = HAT; ctx.beginPath(); ctx.arc(bx, by - 84, 10, 0, Math.PI * 2); ctx.fill();
  }
}

function yuz(ctx, def, fx, by, { ifade, agiz, t, seed }) {
  const kas = KAS[ifade] ?? KAS.notr;
  const kapak = cl(kas[2] + kirpma(t, seed * 7.1) * (1 - kas[2]));
  for (const dx of [-17, 17]) {
    const gx = fx + dx;
    const gy = by + 2;
    const r = 8.5 * kas[4];
    if (def.gozBandi && dx > 0) {
      ctx.fillStyle = HAT; ctx.beginPath(); ctx.ellipse(gx, gy, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = HAT; ctx.beginPath(); ctx.moveTo(gx - 50, gy - 30); ctx.lineTo(gx + 40, gy + 6); ctx.stroke();
      continue;
    }
    ctx.fillStyle = HAT;
    ctx.beginPath(); ctx.ellipse(gx, gy, r, r * Math.max(0.12, 1 - kapak), 0, 0, Math.PI * 2); ctx.fill();
    // gx-10 sol gözün dış ucu, sağ gözün iç ucudur (kaş iç ucu yüzün ortasına bakan uç)
    const ic = dx < 0 ? kas[1] : kas[0];
    const dis = dx < 0 ? kas[0] : kas[1];
    ctx.lineWidth = 4.5; ctx.strokeStyle = HAT; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx - 10, gy - 17 - ic * 0.5); ctx.lineTo(gx + 10, gy - 17 - dis * 0.5); ctx.stroke();
  }
  if (def.yaraIzi) {
    ctx.lineWidth = 4; ctx.strokeStyle = '#9A3A3A'; ctx.beginPath(); ctx.moveTo(fx + 4, by - 30); ctx.lineTo(fx + 34, by + 24); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(fx + 8 + k * 7, by - 18 + k * 11); ctx.lineTo(fx + 20 + k * 7, by - 22 + k * 11); ctx.stroke(); }
  }
  const my = by + 30;
  if (def.sakal === 'sakal') {
    sekil(ctx, [[fx - 40, by + 12], [fx - 32, by + 48], [fx, by + 66], [fx + 32, by + 48], [fx + 40, by + 12], [fx + 20, by + 30], [fx - 20, by + 30]], { fill: def.sakalRenk ?? def.sac ?? HAT, w: 4 });
  }
  const ac = cl(agiz) * (ifade === 'fisilti' ? 0.5 : 1);
  if (ac > 0.06) {
    ctx.fillStyle = '#3A1218'; ctx.beginPath(); ctx.ellipse(fx, my, 12 + ac * 3, 3 + ac * 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = HAT; ctx.stroke();
  } else {
    const k = kas[3] * 8;
    ctx.beginPath(); ctx.moveTo(fx - 14, my - k * 0.3); ctx.quadraticCurveTo(fx, my + k, fx + 14, my - k * 0.3);
    ctx.lineWidth = 4.5; ctx.strokeStyle = def.sakal === 'sakal' ? GOVDE : HAT; ctx.stroke();
  }
  if (def.sakal === 'biyik' || def.sakal === 'sakal') {
    ctx.lineWidth = 8; ctx.strokeStyle = def.sakalRenk ?? def.sac ?? HAT;
    ctx.beginPath(); ctx.moveTo(fx - 18, my - 6); ctx.quadraticCurveTo(fx, my - 18, fx + 18, my - 6); ctx.stroke();
  }
  if (def.sakal === 'kirli') {
    ctx.fillStyle = 'rgba(40,36,32,.55)';
    for (let k = 0; k < 40; k++) ctx.fillRect(fx - 32 + h(k) * 64, by + 18 + h(k * 3.3) * 34, 3, 3);
  }
  if (def.gozluk) {
    ctx.lineWidth = 4; ctx.strokeStyle = HAT;
    for (const dx of [-17, 17]) { ctx.beginPath(); ctx.arc(fx + dx, by + 2, 15, 0, Math.PI * 2); ctx.stroke(); }
  }
}

// Eldeki eşya; el: [x, y], yon: önkolun açısı (radyan, 0 = aşağı)
function esyaCiz(ctx, esya, el, aci, t, seed) {
  if (!esya) return;
  const ux = Math.sin(aci);
  const uy = Math.cos(aci);
  if (esya === 'kilic' || esya === 'tahta-kilic') {
    const boy = esya === 'kilic' ? 190 : 130;
    const renk = esya === 'kilic' ? '#D8DCE2' : '#A87A4A';
    ctx.lineCap = 'round';
    for (const [lw, c] of [[17, HAT], [10, renk]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(el[0] + ux * 14, el[1] + uy * 14); ctx.lineTo(el[0] + ux * boy, el[1] + uy * boy); ctx.stroke();
    }
    if (esya === 'kilic') {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.moveTo(el[0] + ux * 30, el[1] + uy * 30); ctx.lineTo(el[0] + ux * (boy - 20), el[1] + uy * (boy - 20)); ctx.stroke();
    }
    // Kabza ve siper
    ctx.lineWidth = 9; ctx.strokeStyle = '#6A4A1E';
    ctx.beginPath(); ctx.moveTo(el[0] - uy * 26 + ux * 14, el[1] + ux * 26 + uy * 14); ctx.lineTo(el[0] + uy * 26 + ux * 14, el[1] - ux * 26 + uy * 14); ctx.stroke();
  }
  if (esya === 'kalkan') {
    ctx.save(); ctx.translate(el[0], el[1]);
    ctx.fillStyle = '#7A4A26'; ctx.strokeStyle = HAT; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#B8893B'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#B8893B'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (esya === 'mesale' || esya === 'fener') {
    const titre = 0.85 + Math.sin(t * 9 + seed) * 0.08;
    const g = ctx.createRadialGradient(el[0], el[1] - 50, 4, el[0], el[1] - 50, 280);
    g.addColorStop(0, `rgba(255,200,115,${0.45 * titre})`); g.addColorStop(1, 'rgba(255,200,115,0)');
    ctx.fillStyle = g; ctx.fillRect(el[0] - 280, el[1] - 330, 560, 560);
    if (esya === 'mesale') {
      ctx.lineWidth = 12; ctx.strokeStyle = '#5A3A1E'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(el[0], el[1] + 30); ctx.lineTo(el[0], el[1] - 60); ctx.stroke();
      for (const [r, c] of [[26, '#E85A1E'], [17, '#F2B13A'], [9, '#FFF0B0']]) {
        ctx.fillStyle = c; ctx.beginPath();
        ctx.moveTo(el[0] - r, el[1] - 60); ctx.quadraticCurveTo(el[0] - r * 0.6, el[1] - 60 - r * 2.4 - Math.sin(t * 12) * 8, el[0] + Math.sin(t * 7) * 6, el[1] - 60 - r * 3);
        ctx.quadraticCurveTo(el[0] + r * 0.6, el[1] - 60 - r * 2.2, el[0] + r, el[1] - 60); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.lineWidth = 4; ctx.strokeStyle = HAT; ctx.beginPath(); ctx.moveTo(el[0], el[1]); ctx.lineTo(el[0], el[1] + 14); ctx.stroke();
      ctx.fillStyle = `rgba(255,216,144,${titre})`; ctx.beginPath(); ctx.roundRect(el[0] - 17, el[1] + 14, 34, 46, 7); ctx.fill(); ctx.stroke();
    }
  }
  if (esya === 'baston') {
    ctx.lineWidth = 9; ctx.strokeStyle = '#6A4428'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(el[0], el[1] - 10); ctx.lineTo(el[0] + 14, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(el[0] - 12, el[1] - 10, 12, Math.PI, 0); ctx.stroke();
  }
  if (esya === 'oyun-kolu') {
    ctx.save(); ctx.translate(el[0], el[1] - 6);
    ctx.fillStyle = '#2A2A34'; ctx.strokeStyle = HAT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-44, -20, 88, 40, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#D8D8E0'; ctx.fillRect(-32, -4, 20, 7); ctx.fillRect(-25.5, -11, 7, 21);
    for (const [bx, by, c] of [[22, -6, '#E84A4A'], [32, 4, '#4AA8E8'], [12, 4, '#7CD84A']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  if (esya === 'kupa') {
    ctx.save(); ctx.translate(el[0], el[1] - 10);
    ctx.fillStyle = '#F2C23A'; ctx.strokeStyle = HAT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-34, -90); ctx.lineTo(34, -90); ctx.quadraticCurveTo(30, -36, 0, -28); ctx.quadraticCurveTo(-30, -36, -34, -90); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-34, -70, 14, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(34, -70, 14, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    ctx.fillRect(-6, -30, 12, 22); ctx.fillStyle = '#8A6A2A'; ctx.fillRect(-24, -10, 48, 14); ctx.strokeRect(-24, -10, 48, 14);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.sin(t * 4) * 0.3) + ')'; ctx.fillRect(-20, -82, 8, 30);
    ctx.restore();
  }
  if (esya === 'para') {
    ctx.save(); ctx.translate(el[0], el[1] - 14); ctx.rotate(-0.15);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 ? '#5AA85A' : '#4A984A'; ctx.strokeStyle = HAT; ctx.lineWidth = 4;
      ctx.fillRect(-40, -12 - k * 9, 80, 30); ctx.strokeRect(-40, -12 - k * 9, 80, 30);
    }
    ctx.fillStyle = '#D8F0C8'; ctx.beginPath(); ctx.arc(0, -24, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C8A83A'; ctx.fillRect(-8, -42, 16, 40);
    ctx.restore();
  }
  if (esya === 'canta') {
    ctx.save(); ctx.translate(el[0], el[1]);
    ctx.strokeStyle = HAT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-16, 0, 32, 16, 6); ctx.stroke();
    ctx.fillStyle = '#4A2E1A'; ctx.beginPath(); ctx.roundRect(-46, 14, 92, 64, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C8A83A'; ctx.fillRect(-6, 36, 12, 10);
    ctx.restore();
  }
  if (esya === 'disket') {
    ctx.save(); ctx.translate(el[0], el[1] - 30); ctx.rotate(-0.2);
    ctx.fillStyle = '#2A4A9A'; ctx.strokeStyle = HAT; ctx.lineWidth = 5;
    ctx.fillRect(-30, -30, 60, 60); ctx.strokeRect(-30, -30, 60, 60);
    ctx.fillStyle = '#C8CCD4'; ctx.fillRect(-16, -30, 32, 20); ctx.fillStyle = '#F2F2EA'; ctx.fillRect(-22, 4, 44, 22);
    ctx.restore();
  }
  if (esya === 'anahtar') {
    // Anahtar halkası: demir halka ve sallanan iki büyük anahtar
    const sal = Math.sin(t * 5 + seed) * 0.25;
    ctx.save(); ctx.translate(el[0], el[1] + 6);
    ctx.strokeStyle = HAT; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 14, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#B8B0A0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 14, 17, 0, Math.PI * 2); ctx.stroke();
    for (const [dx, a] of [[-6, 0.35 + sal], [7, -0.3 + sal]]) {
      ctx.save(); ctx.translate(dx, 28); ctx.rotate(a);
      ctx.fillStyle = '#C8B070'; ctx.strokeStyle = HAT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 6, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(-3, 12, 6, 34); ctx.strokeRect(-3, 12, 6, 34); ctx.fillRect(3, 36, 9, 5); ctx.fillRect(3, 42, 7, 4);
      ctx.restore();
    }
    ctx.restore();
  }
  if (esya === 'tas') {
    sekil(ctx, [[el[0] - 60, el[1] - 10], [el[0] - 40, el[1] - 70], [el[0] + 30, el[1] - 80], [el[0] + 70, el[1] - 30], [el[0] + 50, el[1] + 10]], { fill: '#8A8478', w: 6 });
  }
}

function zincirHalka(ctx, a, b, n) {
  ctx.lineWidth = 4; ctx.strokeStyle = '#9A9AA4';
  for (let k = 0; k <= n; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / n;
    const y = a[1] + ((b[1] - a[1]) * k) / n + Math.sin((k / n) * Math.PI) * 14;
    ctx.beginPath(); ctx.ellipse(x, y, 9, 6, k % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
  }
}

// o: { x, y (ayak hizası), s, t, poz, pozU, yon (1 sağa, -1 sola bakar), ifade, agiz, solgun, seed, konusuyor, esya,
//      gecis: { poz, u } (isteğe bağlı: önceki poz ve değişeli geçen saniye; yumuşak geçiş için) }
// Döner: ön elin dünya koordinatı (zincir bağlamak için).
export function cop(ctx, def, o) {
  const { x, y, t = 0, yon = 1, ifade = 'notr', agiz = 0, solgun = 0, seed = 1, konusuyor = false } = o;
  const s = (o.s ?? 1) * (def.olcek ?? 1);
  const p = gecisliPoz(o.poz ?? 'dur', o.gecis, t, seed, konusuyor, def.yas === 'yasli', o.pozU);
  const kalinlik = 15 * (def.kalin ?? 1);
  const arkaRenk = ton(GOVDE, 0.8);
  const esya = o.esya !== undefined ? o.esya : def.esya ?? (['fener', 'baston', 'mesale'].includes(def.aksesuar) ? def.aksesuar : null);
  const [onEsya, arkaEsya] = esya === 'kilic+kalkan' ? ['kilic', 'kalkan'] : [esya, null];
  ctx.save();
  if (def.siluet) ctx.filter = 'brightness(0.1)';
  else if (solgun > 0) ctx.filter = `brightness(${1 - 0.35 * solgun})`;
  ctx.translate(x, y - p.zipla * s);
  ctx.scale(s * yon, s);

  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.yatis * -200, 6 + p.zipla, 85 + p.yatis * 160, 14, 0, 0, Math.PI * 2); ctx.fill();
  // Yere düşme: bütün beden ayak ucu etrafında sırtüstü döner
  if (p.yatis > 0) { ctx.translate(0, -24 * p.yatis); ctx.rotate(-p.yatis * Math.PI * 0.5); }

  const kalca = [0, COP.kalca];
  const govdeBoy = COP.kalca - COP.omuz;
  const omuz = [Math.sin(p.egim) * govdeBoy, COP.kalca - Math.cos(p.egim) * govdeBoy];
  const boyun = [omuz[0] + Math.sin(p.egim) * 28, omuz[1] - Math.cos(p.egim) * 28];

  // Pelerin (arkada, rüzgârda dalgalanır)
  if (def.pelerin) {
    const dal = Math.sin(t * 2.2 + seed) * 18;
    sekil(ctx, [[boyun[0] + 10, boyun[1] + 6], [boyun[0] - 60, boyun[1] + 60], [-110 + dal, -60], [-60 + dal * 0.5, -40], [kalca[0] - 10, kalca[1] - 40]], { fill: def.pelerin, w: 5 });
  }
  uzuv(ctx, bacakNokta(kalca, p.arkaB[0], p.arkaB[1]), kalinlik, arkaRenk);
  const arkaKol = kolNokta(omuz, p.arka[0], p.arka[1]);
  uzuv(ctx, arkaKol, kalinlik, arkaRenk);
  if (arkaEsya) esyaCiz(ctx, arkaEsya, arkaKol[2], p.arka[0] + p.arka[1], t, seed);
  uzuv(ctx, [kalca, omuz, boyun], kalinlik + 3, GOVDE);
  if (def.onluk) sekil(ctx, [[omuz[0] - 26, omuz[1] + 30], [omuz[0] + 30, omuz[1] + 30], [kalca[0] + 34, kalca[1] + 70], [kalca[0] - 30, kalca[1] + 70]], { fill: def.onluk, w: 5 });
  if (def.kusak) {
    ctx.lineCap = 'round';
    for (const [lw, c] of [[22, HAT], [14, def.kusak]]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-26, COP.kalca - 8); ctx.lineTo(26, COP.kalca - 8); ctx.moveTo(-18, COP.kalca - 4); ctx.lineTo(-34, COP.kalca + 50); ctx.stroke(); }
  }
  // Vurgu rengi atkı: karakteri uzaktan tanıtır
  if (def.renk && def.atki !== false && def.sacStil !== 'basortusu') {
    ctx.lineCap = 'round';
    for (const [lw, c] of [[24, HAT], [16, def.renk]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(boyun[0] - 22, boyun[1] + 4); ctx.lineTo(boyun[0] + 22, boyun[1] + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(boyun[0] - 14, boyun[1] + 6); ctx.lineTo(boyun[0] - 24, boyun[1] + 60); ctx.stroke();
    }
  }
  uzuv(ctx, bacakNokta(kalca, p.onB[0], p.onB[1]), kalinlik, GOVDE);

  // Konuşurken baş hafifçe sallanır (ağız açıklığıyla birlikte): karakter "canlı" durur
  const basOyna = konusuyor ? Math.sin(t * 6.3 + seed) * 2.2 + cl(agiz) * 2.5 : 0;
  const bx = boyun[0] + Math.sin(p.egim) * COP.bas + (konusuyor ? Math.sin(t * 3.1 + seed * 2) * 1.6 : 0);
  const by = boyun[1] - COP.bas * Math.cos(p.egim) + 4 - basOyna;
  if (def.sacStil === 'uzun' || def.sacStil === 'atkuyrugu' || def.sacStil === 'orgu') {
    ctx.lineCap = 'round';
    const sal = Math.sin(t * 2.5 + seed) * 8;
    const ornek = def.sacStil === 'orgu' ? [[-40, 0], [40, 0]] : [[0, 0]];
    for (const [ox] of ornek) {
      for (const [lw, c] of [[28, HAT], [20, def.sac ?? '#2A1D16']]) {
        ctx.lineWidth = lw; ctx.strokeStyle = c;
        ctx.beginPath(); ctx.moveTo(bx - 42 + ox * 0.5, by - 24); ctx.quadraticCurveTo(bx - 86 + ox, by + 6, bx - 72 + ox + sal, by + 74); ctx.stroke();
      }
    }
  }
  if (def.sacStil === 'basortusu') {
    sekil(ctx, [[bx - 74, by + 56], [bx - 76, by - 20], [bx - 42, by - 74], [bx + 30, by - 78], [bx + 72, by - 32], [bx + 74, by + 44], [bx + 30, by + 86], [bx - 34, by + 88]], { fill: def.sac, w: 6 });
  }
  if (def.robot) {
    // Robot kafası: metal kutu, anten ışığı, parlayan gözler, konuşurken yanıp sönen ağız LED'i
    const r = COP.bas;
    ctx.lineWidth = 6; ctx.strokeStyle = HAT;
    ctx.beginPath(); ctx.moveTo(bx, by - r); ctx.lineTo(bx, by - r - 34); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 5 + seed) > 0 ? '#FF4A4A' : '#7A2A2A'; ctx.beginPath(); ctx.arc(bx, by - r - 40, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.renk ?? '#B8C4D0'; ctx.beginPath(); ctx.roundRect(bx - r, by - r, r * 2, r * 2, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#10161E'; ctx.beginPath(); ctx.roundRect(bx - r * 0.72, by - r * 0.45, r * 1.44, r * 0.6, 10); ctx.fill();
    const goz = kirpma(t, seed * 7.1) > 0.5 ? 0.25 : 1;
    ctx.fillStyle = '#3EE0FF'; ctx.shadowColor = '#3EE0FF'; ctx.shadowBlur = 14;
    for (const dx of [-0.32, 0.36]) { ctx.beginPath(); ctx.ellipse(bx + dx * r + 10, by - r * 0.15, 9, 9 * goz, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
    const ac = cl(agiz);
    ctx.fillStyle = ac > 0.06 ? '#3EE0FF' : '#2A3A48';
    ctx.fillRect(bx - r * 0.35 + 10, by + r * 0.42 - ac * 6, r * 0.7, 8 + ac * 12);
  } else {
    ctx.beginPath(); ctx.arc(bx, by, COP.bas, 0, Math.PI * 2);
    ctx.fillStyle = GOVDE; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = HAT; ctx.stroke();
    sacVeSapka(ctx, def, bx, by);
    yuz(ctx, def, bx + 14, by, { ifade, agiz, t, seed });
  }

  const kol = kolNokta(omuz, p.on[0], p.on[1]);
  uzuv(ctx, kol, kalinlik, GOVDE);
  if (def.zincir || o.poz === 'zincirli') {
    if (o.poz === 'zincirli') zincirHalka(ctx, kol[2], arkaKol[2], 5);
    else zincirHalka(ctx, [kol[1][0] * 0.3 + kol[2][0] * 0.7, kol[1][1] * 0.3 + kol[2][1] * 0.7], [kol[2][0] + 10, kol[2][1] + 40], 2);
  }
  if (def.siluet) ctx.filter = 'none';
  // Kılıç vuruş izi: iniş sırasında kılıcın taradığı yay beyaz bir iz bırakır (0,35 sn'de söner)
  if (o.poz === 'kilic-indir' && (onEsya === 'kilic' || onEsya === 'tahta-kilic') && (o.pozU ?? 9) < 0.35) {
    const aci = p.on[0] + p.on[1] * 0.5;
    const R = COP.kol1 + COP.kol2 + 150;
    const sol = 1 - (o.pozU ?? 0) / 0.35;
    const th0 = Math.PI / 2 - 2.75;
    const th1 = Math.PI / 2 - aci;
    if (th1 > th0 + 0.05) {
      const g = ctx.createRadialGradient(omuz[0], omuz[1], R - 170, omuz[0], omuz[1], R + 10);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, `rgba(235,242,255,${0.55 * sol})`); g.addColorStop(1, `rgba(255,255,255,${0.9 * sol})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(omuz[0], omuz[1], R + 10, th0, th1); ctx.arc(omuz[0], omuz[1], R - 170, th1, th0, true); ctx.closePath(); ctx.fill();
    }
  }
  esyaCiz(ctx, onEsya, kol[2], p.on[0] + p.on[1], t, seed);
  ctx.restore();
  return { el: [x + kol[2][0] * s * yon, y - p.zipla * s + kol[2][1] * s], elArka: [x + arkaKol[2][0] * s * yon, y - p.zipla * s + arkaKol[2][1] * s] };
}
