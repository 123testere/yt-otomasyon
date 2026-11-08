// Animasyonlu dizi (Gece Hikâyeleri ve destan dizileri): dikey Shorts (1080x1920) ya da yatay uzun video (1920x1080).
// Mekân ve karakterler kodla çizilir (shared/dizi.js, shared/cop.js, shared/mekan-destan.js).
// Sahne: { t0, d, mekan, zaman, efektler, saat, kalabalik, kart: {ust, alt}, kartSn, kadraj: [...], nesneler: [...],
//          zincir: {a, b, sn}, cizim, satirlar: [{kim, t0, t1, ifade, poz}] }
// Kadraj öğesi: { id, x (0-1), yon, poz, ifade, esya, olcek, hareket: {x0, x1, sure, kos}, adimlar: [{sn, poz, x, yon, esya, ifade, sarsinti, darbe}] }
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, Html5Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { serif, serifReady } from './fonts.js';
import { agizAcikligi, karakter, mekan } from '../../shared/dizi.js';
import { cop } from '../../shared/cop.js';
import { DESTAN_MEKANLAR, destanMekan } from '../../shared/mekan-destan.js';
import { OYUN_MEKANLAR, oyunMekan } from '../../shared/mekan-oyun.js';
import { TEKNO_MEKANLAR, teknoMekan } from '../../shared/mekan-tekno.js';
import { ALAN, derle, eo, h, kit, pr } from '../../shared/cizim.js';

const KART_SN = 2.4; // açılış kartı
const GECIS = 0.3;
export const KAPANIS_SN = 3.2; // motor anlatımın sonuna bu kadar sessiz süre ekler
const RENK = { altin: '#F2B45A', kagit: '#F3EAD7', gece: '#0B1020' };

function useFontReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender('Lora');
    serifReady.then(() => { setReady(true); continueRender(handle); });
  }, []);
  return ready;
}

function yazi(ctx, s, x, y, size, { c = RENK.kagit, a = 1, al = 'center', w = 700, it = false, golge = true } = {}) {
  if (a <= 0 || !s) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `${it ? 'italic ' : ''}${w} ${size}px ${serif}`;
  ctx.textAlign = al; ctx.textBaseline = 'alphabetic';
  if (golge) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 18; }
  ctx.fillStyle = c; ctx.fillText(s, x, y); ctx.restore();
}

// Konuşan adının rengi: koyu karakter rengi kutuda okunmaz, altın kullanılır.
function acikRenk(c) {
  if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return RENK.altin;
  const n = parseInt(c.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.45 ? RENK.altin : c;
}

function satirla(ctx, metin, size, maxW, it) {
  ctx.font = `${it ? 'italic ' : ''}700 ${size}px ${serif}`;
  const out = [];
  let cur = '';
  for (const w of metin.split(' ')) {
    const tr = `${cur} ${w}`.trim();
    if (ctx.measureText(tr).width > maxW && cur) { out.push(cur); cur = w; } else cur = tr;
  }
  if (cur) out.push(cur);
  return out;
}

// Altyazı grupları: konuşan değişince ya da cümle bitince yeni grup.
function gruplar(words) {
  const out = [];
  let cur = [];
  const bitir = () => { if (cur.length) out.push(cur); cur = []; };
  for (const w of words) {
    if (cur.length && (cur[0].konusan !== w.konusan || cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length > 64)) bitir();
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) bitir();
  }
  bitir();
  return out.map((g, i) => ({ t0: g[0].t, son: g.at(-1).t + g.at(-1).d, konusan: g[0].konusan, metin: g.map((w) => w.text).join(' '), next: out[i + 1]?.[0].t }));
}

// Kadraj: 1 kişi ortada büyük, 2 kişi karşılıklı, 3 kişi yan yana (yüz stili).
function yerlesim(n, W) {
  const k = W / 1080;
  if (n <= 1) return [{ x: 540 * k, s: 1.18, yon: 1 }];
  if (n === 2) return [{ x: 300 * k, s: 1, yon: 1 }, { x: 790 * k, s: 1, yon: -1 }];
  return [{ x: 210 * k, s: 0.82, yon: 1 }, { x: 540 * k, s: 0.9, yon: 1 }, { x: 880 * k, s: 0.82, yon: -1 }];
}

function yakinCekim(ctx, fn, u, t, W, H) {
  if (!fn) return;
  const a = eo(pr(u, 0, 0.4));
  const kw = Math.min(W - 120, 960);
  const k = { x: (W - kw) / 2, y: H * 0.22, w: kw, h: kw * 0.7 };
  ctx.save(); ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 40;
  ctx.fillStyle = '#EFE4CB'; ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 16); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 16); ctx.clip();
  ctx.translate(k.x, k.y); ctx.scale(k.w / ALAN.w, k.h / ALAN.h);
  try { fn(kit(ctx, t, { font: serif }), u); } catch { /* hatalı çizim: boş kart */ }
  ctx.restore();
}

// Kadraj öğesinin sahnedeki u. saniyedeki durumu (adımlar zaman çizelgesi).
function durum(k, u, varsayilanX, d) {
  let x = k.x ?? varsayilanX;
  let onceX = x;
  let xT = -9;
  const st = { poz: k.poz, yon: k.yon, esya: k.esya, ifade: k.ifade, pozT: 0 };
  if (k.hareket) {
    const ilerle = eo(pr(u, 0, Math.max(0.5, k.hareket.sure ?? d * 0.6)));
    x = k.hareket.x0 + (k.hareket.x1 - k.hareket.x0) * ilerle;
    onceX = x;
    if (ilerle < 1) st.poz = k.hareket.kos ? 'kos' : 'yuru';
    st.yon = st.yon ?? (Math.sign(k.hareket.x1 - k.hareket.x0) || 1);
  }
  let vurgu = null;
  for (const a of k.adimlar ?? []) {
    if (a.sn > u) break;
    if (a.x !== undefined) { onceX = x; x = a.x; xT = a.sn; }
    if (a.poz !== undefined && a.poz !== st.poz) { st.poz = a.poz; st.pozT = a.sn; }
    if (a.yon !== undefined) st.yon = a.yon;
    if (a.esya !== undefined) st.esya = a.esya;
    if (a.ifade !== undefined) st.ifade = a.ifade;
    if (a.sarsinti || a.darbe) vurgu = { sn: a.sn, darbe: a.darbe };
  }
  // Adımdaki yer değişimi 0,35 sn'de kayarak olur
  const kay = eo(pr(u, xT, xT + 0.35));
  st.x = onceX + (x - onceX) * kay;
  st.vurgu = vurgu;
  return st;
}

function nesneCiz(ctx, n, u, W, yer, s) {
  if ((n.gorun !== undefined && u < n.gorun) || (n.kaybol !== undefined && u >= n.kaybol)) return;
  let x = n.x * W;
  let y = yer;
  let aci = n.aci ?? 1.4;
  if (n.ucus) {
    if (u < n.ucus.sn0) return;
    const p = pr(u, n.ucus.sn0, n.ucus.sn1);
    x = (n.ucus.x0 + (n.x - n.ucus.x0) * p) * W;
    y = yer - Math.sin(p * Math.PI) * 260 * s;
    aci = (n.aci ?? 1.4) + (1 - p) * 9;
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(aci); ctx.scale(s, s);
  if (n.tip === 'kilic') {
    for (const [lw, c] of [[17, '#0C0A10'], [10, '#D8DCE2']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -190); ctx.stroke(); }
    ctx.lineWidth = 9; ctx.strokeStyle = '#6A4A1E'; ctx.beginPath(); ctx.moveTo(-26, -20); ctx.lineTo(26, -20); ctx.stroke();
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
  } else if (n.tip === 'kirik-kalkan' || n.tip === 'kalkan') {
    const kirik = n.tip === 'kirik-kalkan';
    ctx.fillStyle = '#7A4A26'; ctx.strokeStyle = '#0C0A10'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 66, kirik ? 0.4 : 0, kirik ? Math.PI * 1.2 : Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

const SIRA_RENK = { 1: '#FFC23A', 2: '#D8DEE8', 3: '#E0884A' };

// Haber kartı: üstte etiket (ör. SON DAKİKA), çok satırlı başlık, kaynak ve tarih, sırayla beliren maddeler
function haberKarti(ctx, hb, u, W, H, yatay) {
  const renk = hb.renk ?? '#3EE0FF';
  const a = eo(pr(u, 0, 0.35));
  const n = (hb.maddeler ?? []).length;
  ctx.save();
  ctx.font = `900 ${yatay ? 76 : 70}px ${serif}`;
  const kw = yatay ? W * 0.62 : W - 160;
  const kx = (W - kw) / 2;
  const satirlar = [];
  for (const kelime of String(hb.baslik).split(/\s+/)) {
    const son = satirlar.at(-1);
    if (son && ctx.measureText(`${son} ${kelime}`).width <= kw - 100) satirlar[satirlar.length - 1] = `${son} ${kelime}`;
    else satirlar.push(kelime);
  }
  const bs = satirlar.slice(0, 3);
  const satH = yatay ? 86 : 80;
  const ky = yatay ? H * 0.08 : 590;
  const kh = 150 + bs.length * satH + 70 + n * (yatay ? 92 : 100) + 30;
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * 40);
  ctx.fillStyle = 'rgba(6,10,22,.86)'; ctx.beginPath(); ctx.roundRect(kx, ky, kw, kh, 30); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = renk; ctx.shadowColor = renk; ctx.shadowBlur = 24; ctx.stroke(); ctx.shadowBlur = 0;
  // Etiket hapı (yanıp söner)
  const et = hb.etiket ?? 'SON DAKİKA';
  ctx.font = `800 40px ${serif}`;
  const ew = ctx.measureText(et).width + 70;
  ctx.fillStyle = '#E8283A'; ctx.beginPath(); ctx.roundRect(kx + 40, ky - 30, ew, 64, 32); ctx.fill();
  ctx.fillStyle = Math.sin(u * 7) > 0 ? '#FFFFFF' : '#FFB0B8'; ctx.beginPath(); ctx.arc(kx + 72, ky + 2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(et, kx + 94, ky + 3);
  // Başlık
  ctx.font = `900 ${yatay ? 76 : 70}px ${serif}`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#FFFFFF';
  bs.forEach((s, k) => ctx.fillText(s, kx + 50, ky + 120 + k * satH));
  // Kaynak
  const kyKaynak = ky + 120 + bs.length * satH + 10;
  if (hb.kaynak) { ctx.font = `italic 500 ${yatay ? 42 : 40}px ${serif}`; ctx.fillStyle = renk; ctx.fillText(hb.kaynak, kx + 50, kyKaynak); }
  ctx.restore();
  (hb.maddeler ?? []).forEach((m, k) => {
    const b = eo(pr(u, 0.8 + k * 0.8, 1.2 + k * 0.8)) * a;
    if (b <= 0) return;
    const y = kyKaynak + 80 + k * (yatay ? 92 : 100);
    ctx.save(); ctx.globalAlpha = b;
    ctx.fillStyle = renk; ctx.beginPath(); ctx.arc(kx + 70 - (1 - b) * 30, y - 14, 12, 0, Math.PI * 2); ctx.fill();
    ctx.font = `700 ${yatay ? 50 : 48}px ${serif}`; ctx.fillStyle = '#F4F0E8'; ctx.textAlign = 'left';
    ctx.fillText(m, kx + 100 - (1 - b) * 30, y);
    ctx.restore();
  });
}

function siraKarti(ctx, s, u, W, H, yatay) {
  const renk = SIRA_RENK[s.no] ?? (s.no % 2 ? '#3EE0FF' : '#FF3EA5');
  const n = (s.maddeler ?? []).length;
  const [x0, y0, kw, kh] = yatay ? [W * 0.2, H * 0.08, W * 0.6, 340 + n * 105] : [80, 590, W - 160, 350 + n * 115];
  const a = eo(pr(u, 0, 0.35));
  const pop = 1 + (1 - eo(pr(u, 0, 0.45))) * 0.25;
  ctx.save();
  ctx.translate(x0 + kw / 2, y0 + kh / 2); ctx.scale(pop, pop); ctx.translate(-(x0 + kw / 2), -(y0 + kh / 2));
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,6,20,.82)'; ctx.beginPath(); ctx.roundRect(x0, y0, kw, kh, 36); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = renk; ctx.shadowColor = renk; ctx.shadowBlur = 30; ctx.stroke(); ctx.shadowBlur = 0;
  // Sıra numarası rozeti
  const rx = x0 + (yatay ? 150 : 140);
  const ry = y0 + (yatay ? 150 : 150);
  const rr = yatay ? 105 : 100;
  ctx.fillStyle = renk; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
  ctx.font = `900 ${rr * 1.15}px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0A0814'; ctx.fillText(`#${s.no}`, rx, ry + rr * 0.06);
  // Oyunun adı (sığmazsa küçülür)
  const tx = rx + rr + 40;
  const tw = x0 + kw - 40 - tx;
  let boy = yatay ? 92 : 80;
  ctx.font = `900 ${boy}px ${serif}`;
  while (ctx.measureText(s.ad).width > tw && boy > 40) { boy -= 4; ctx.font = `900 ${boy}px ${serif}`; }
  ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(s.ad, tx, ry - (s.tur ? boy * 0.3 : 0));
  if (s.tur) { ctx.font = `italic 500 ${yatay ? 44 : 40}px ${serif}`; ctx.fillStyle = renk; ctx.fillText(s.tur, tx, ry + boy * 0.55); }
  ctx.restore();
  // Geri sayım çubuğu (dikey): 5 · 4 · 3 · 2 · 1, geçilenler sönük, sıradaki parlak
  if (!yatay) {
    const toplam = s.toplam ?? 5;
    const cy = 1640;
    const ar = 150;
    for (let k = toplam; k >= 1; k--) {
      const cx = W / 2 + (toplam - k - (toplam - 1) / 2) * ar;
      const simdi = k === s.no;
      const gecti = k > s.no;
      const rr = simdi ? 58 * (1 + Math.sin(u * 6) * 0.05) : 40;
      ctx.save(); ctx.globalAlpha = a * (gecti ? 0.45 : simdi ? 1 : 0.25);
      ctx.fillStyle = simdi ? renk : gecti ? (SIRA_RENK[k] ?? '#8A8AA8') : '#2A2A40';
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.font = `900 ${rr}px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = simdi ? '#0A0814' : '#F4F0E8'; ctx.fillText(String(k), cx, cy + 3);
      ctx.restore();
    }
  }
  // Özellikler: tek tek belirir
  const maddeler = s.maddeler ?? [];
  const my0 = y0 + (yatay ? 330 : 340);
  const ara = yatay ? 105 : 115;
  const mboy = yatay ? 56 : 54;
  maddeler.forEach((m, k) => {
    const b = eo(pr(u, 0.7 + k * 0.8, 1.1 + k * 0.8)) * a;
    if (b <= 0) return;
    const y = my0 + k * ara;
    const kx = x0 + 70 - (1 - b) * 40;
    ctx.save(); ctx.globalAlpha = b;
    ctx.fillStyle = renk; ctx.beginPath(); ctx.roundRect(kx, y - mboy * 0.55, mboy * 1.1, mboy * 1.1, 12); ctx.fill();
    ctx.strokeStyle = '#0A0814'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(kx + mboy * 0.25, y); ctx.lineTo(kx + mboy * 0.48, y + mboy * 0.25); ctx.lineTo(kx + mboy * 0.88, y - mboy * 0.25); ctx.stroke();
    ctx.font = `700 ${mboy}px ${serif}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#F4F0E8';
    ctx.fillText(m, kx + mboy * 1.5, y + 2);
    ctx.restore();
  });
}

const METIN = {
  tr: { bolum: 'BÖLÜM', bolumK: 'Bölüm', onceki: 'Önceki bölümde…', yorum: 'Yorumlara yaz 👇', devami: 'DEVAMI' },
  en: { bolum: 'EP', bolumK: 'Episode', onceki: 'Previously…', yorum: 'Comment below 👇', devami: 'TO BE CONTINUED' },
};

export function kare(ctx, p, t, dur, fns) {
  const M = METIN[p.dil] ?? METIN.tr;
  const { scenes, words, karakterler = {}, dizi, bolum, kapanis } = p;
  const W = p.width ?? 1080;
  const H = p.height ?? 1920;
  const yatay = W > H;
  let i = 0;
  for (let k = 0; k < scenes.length; k++) if (t >= scenes[k].t0) i = k;
  const sc = scenes[i];
  const u = t - sc.t0;
  const ef = sc.efektler ?? [];
  // Ağır çekim: karakter hareketleri yavaşlar (ses normal akar)
  const tc = ef.includes('agir-cekim') ? sc.t0 + u * 0.3 : t;
  const uc = tc - sc.t0;

  const copStil = p.stil === 'cop';
  const kadraj = sc.kadraj ?? [];
  const varsX = [[0.5], [0.3, 0.7], [0.2, 0.5, 0.8], [0.15, 0.38, 0.62, 0.85]][Math.min(3, Math.max(0, kadraj.length - 1))];
  const durumlar = kadraj.map((k, j) => durum(k, uc, varsX[j] ?? 0.5, sc.d));
  const vurgu = durumlar.map((d) => d.vurgu).filter(Boolean).sort((a, b) => b.sn - a.sn)[0];
  const sars = vurgu && uc - vurgu.sn < 0.45 ? (1 - (uc - vurgu.sn) / 0.45) * 22 : 0;

  ctx.save();
  if (sars) ctx.translate((h(Math.floor(t * 30)) - 0.5) * sars, (h(Math.floor(t * 30) + 7) - 0.5) * sars);
  if (TEKNO_MEKANLAR.includes(sc.mekan)) {
    teknoMekan(ctx, sc.mekan, { W, H, t, kamera: u / Math.max(1, sc.d) });
  } else if (OYUN_MEKANLAR.includes(sc.mekan)) {
    oyunMekan(ctx, sc.mekan, { W, H, t, kamera: u / Math.max(1, sc.d), kalabalik: sc.kalabalik ?? 0.5, veri: sc.veri });
  } else if (DESTAN_MEKANLAR.includes(sc.mekan)) {
    destanMekan(ctx, sc.mekan, { W, H, t, kamera: u / Math.max(1, sc.d), kalabalik: sc.kalabalik ?? 0.5 });
  } else {
    mekan(ctx, sc.mekan, { W, H, t, zaman: sc.zaman, efektler: ef, saat: sc.saat, kamera: u / Math.max(1, sc.d) });
  }
  if (sc.cizim) yakinCekim(ctx, fns[i], u, t, W, H);

  const aktif = words.find((w) => t >= w.t && t < w.t + w.d + 0.08);
  const konusan = aktif?.konusan ?? null;
  const yer = yatay ? H * 0.84 : 1430;
  const olcek = yatay ? (H / 1080) * 0.86 : 1.3;
  for (const n of sc.nesneler ?? []) nesneCiz(ctx, n, uc, W, yer, olcek);
  const eller = {};
  const yerler = yerlesim(kadraj.length, W);
  kadraj.forEach((k, j) => {
    const def = karakterler[k.id];
    if (!def) return;
    const konus = konusan === k.id;
    const satir = [...(sc.satirlar ?? [])].reverse().find((s) => s.kim === k.id && t >= s.t0 && (s.ifade || s.poz));
    const st = durumlar[j];
    const solgun = konusan && konusan !== 'anlatici' && karakterler[konusan] && !konus ? 1 : 0;
    const agiz = konus ? agizAcikligi(words, t) : 0;
    if (copStil) {
      // Satırdaki poz, adımdaki pozdan daha yeniyse onu kullan
      const satirYeni = satir?.poz && satir.t0 - sc.t0 >= st.pozT;
      const poz = satirYeni ? satir.poz : st.poz ?? 'dur';
      const pozU = uc - (satirYeni ? satir.t0 - sc.t0 : st.pozT);
      const yon = st.yon ?? (st.x < 0.5 ? 1 : -1);
      const r = cop(ctx, def, {
        x: st.x * W, y: yer, s: (k.olcek ?? 1) * olcek * (sc.cizim ? 0.75 : 1), yon, t: tc, konusuyor: konus,
        poz, pozU, ifade: (satir?.ifade && satir.t0 - sc.t0 >= st.pozT ? satir.ifade : st.ifade) ?? 'notr', agiz, solgun, seed: def.seed ?? j + 1, esya: st.esya,
      });
      eller[k.id] = r.el;
      return;
    }
    const yerK = yerler[j];
    const giris = eo(pr(u, 0, 0.35));
    karakter(ctx, def, {
      x: yerK.x, y: H + 30 + (1 - giris) * 120, s: yerK.s * (sc.cizim ? 0.8 : 1), yon: yerK.yon, t,
      ifade: satir?.ifade ?? k.ifade ?? 'notr', bakis: k.bakis ?? (kadraj.length > 1 ? 0.5 : 0), agiz, solgun, seed: def.seed ?? j + 1,
    });
  });
  // Zincirle bağlama (ör. kahraman zinciri rakibin koluna dolar)
  if (sc.zincir && uc >= (sc.zincir.sn ?? 0) && uc < (sc.zincir.bitis ?? 1e9) && eller[sc.zincir.a] && eller[sc.zincir.b]) {
    const [a, b] = [eller[sc.zincir.a], eller[sc.zincir.b]];
    ctx.lineWidth = 5; ctx.strokeStyle = '#B0B0BA';
    const n = 10;
    for (let k = 0; k <= n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n;
      const y = a[1] + ((b[1] - a[1]) * k) / n + Math.sin((k / n) * Math.PI) * 18;
      ctx.beginPath(); ctx.ellipse(x, y, 11, 7, k % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();

  // Darbe anında kırmızı, sahne başında beyaz çakma
  if (vurgu?.darbe && uc - vurgu.sn < 0.25) { ctx.fillStyle = `rgba(200,30,30,${0.35 * (1 - (uc - vurgu.sn) / 0.25)})`; ctx.fillRect(0, 0, W, H); }
  if (ef.includes('beyaz-cakma') && u < 0.5) { ctx.fillStyle = `rgba(255,255,255,${1 - u / 0.5})`; ctx.fillRect(0, 0, W, H); }
  if (ef.includes('agir-cekim')) { ctx.fillStyle = 'rgba(20,30,50,.18)'; ctx.fillRect(0, 0, W, H); }
  if (i > 0 && u < GECIS && !ef.includes('beyaz-cakma')) { ctx.fillStyle = `rgba(0,0,0,${1 - u / GECIS})`; ctx.fillRect(0, 0, W, H); }

  // Üst rozet: dizi adı ve bölüm
  const acilisSn = p.acilis === false ? 0 : KART_SN;
  const kartBitti = t > acilisSn;
  const rozet = `${(dizi?.ad ?? '').toLocaleUpperCase(p.dil ?? 'tr')}${p.rozetNo === false ? '' : bolum?.toplam ? ` · ${bolum.no}/${bolum.toplam}` : bolum?.no ? ` · ${M.bolum} ${bolum.no}` : ''}`;
  if (yatay) yazi(ctx, rozet, 50, 70, 34, { c: RENK.altin, a: kartBitti ? 0.85 : 0, al: 'left' });
  else yazi(ctx, rozet, 540, 150, 40, { c: RENK.altin, a: kartBitti ? 0.9 : 0 });
  if (sc.ozet && kartBitti) yazi(ctx, M.onceki, W / 2, yatay ? 140 : 220, 44, { it: true, w: 500, a: 0.85 });

  // Dev yazı (ör. "30 MİLYON" / "kopya sattı"): sahne boyunca görünür, karakterlerin üstünde
  if (sc.buyukYazi && kartBitti) {
    const a = eo(pr(u, 0.15, 0.55));
    const zip = 1 + (1 - eo(pr(u, 0.15, 0.5))) * 0.4;
    const cy = yatay ? H * 0.3 : 690;
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(zip, zip); ctx.translate(-W / 2, -cy);
    let boy = yatay ? 130 : 120;
    ctx.font = `900 ${boy}px ${serif}`;
    while (ctx.measureText(sc.buyukYazi.ust).width > W * 0.9 && boy > 50) { boy -= 6; ctx.font = `900 ${boy}px ${serif}`; } ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.globalAlpha = a; ctx.lineWidth = boy * 0.14; ctx.strokeStyle = '#000'; ctx.strokeText(sc.buyukYazi.ust, W / 2, cy);
    ctx.fillStyle = '#FFC23A'; ctx.fillText(sc.buyukYazi.ust, W / 2, cy);
    ctx.restore();
    if (sc.buyukYazi.alt) yazi(ctx, sc.buyukYazi.alt, W / 2, cy + (yatay ? 80 : 76), yatay ? 56 : 54, { a, w: 700 });
  }

  // Sıralama kartı: dev sıra numarası, oyunun adı ve sırayla beliren özellikler
  if (sc.sira && kartBitti) siraKarti(ctx, sc.sira, u, W, H, yatay);
  if (sc.haber && kartBitti) haberKarti(ctx, sc.haber, u, W, H, yatay);

  // Ara kart (ör. "15 YIL ÖNCE", "BİRİNCİ KISIM · Demirci'nin Oğlu")
  const ks = sc.kartSn ?? 2.2;
  const kartVar = sc.kart && u < ks;
  if (kartVar) {
    const a = eo(pr(u, 0, 0.3)) * (1 - pr(u, ks - 0.4, ks));
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(4,4,8,.92)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    yazi(ctx, sc.kart.ust, W / 2, H / 2 - (sc.kart.alt ? 20 : -30), yatay ? 96 : 92, { c: RENK.altin, a });
    if (sc.kart.alt) yazi(ctx, sc.kart.alt, W / 2, H / 2 + 70, yatay ? 56 : 58, { it: true, w: 500, a });
  }

  // Altyazı
  const kapanisVar = kapanis && t >= dur - KAPANIS_SN;
  const g = gruplar(words).find((q) => t >= q.t0 && t < Math.max(q.son + 0.3, q.next ?? 0));
  if (g && kartBitti && !kapanisVar && !kartVar) {
    const def = karakterler[g.konusan];
    const anlatici = !def || g.konusan === 'anlatici';
    const boyut = yatay ? 46 : 56;
    const genis = yatay ? 1400 : 900;
    const sat = satirla(ctx, g.metin, boyut, genis, anlatici).slice(0, yatay ? 2 : 3);
    const satH = boyut * 1.3;
    const hh = sat.length * satH + (anlatici ? 40 : boyut + 40);
    const y0 = yatay ? H - 40 - hh : copStil ? 290 : 890;
    ctx.save(); ctx.fillStyle = 'rgba(6,8,16,.72)'; ctx.beginPath(); ctx.roundRect((W - genis) / 2 - 40, y0, genis + 80, hh, 22); ctx.fill(); ctx.restore();
    let y = y0 + boyut + 14;
    if (!anlatici) {
      yazi(ctx, (def.ad ?? g.konusan).toLocaleUpperCase(p.dil ?? 'tr'), (W - genis) / 2, y, boyut * 0.7, { c: acikRenk(def.renk), al: 'left', golge: false });
      y += boyut;
    }
    sat.forEach((s, j) => yazi(ctx, s, W / 2, y + j * satH, boyut, { it: anlatici, w: anlatici ? 500 : 700 }));
  }

  // Açılış kartı: dizi adı, bölüm numarası ve adı
  if (acilisSn && t < acilisSn + 0.4) {
    const a = 1 - pr(t, acilisSn, acilisSn + 0.4);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(4,6,12,.86)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const b = eo(pr(t, 0.1, 0.8)) * a;
    const cy = H / 2 - (yatay ? 40 : 200);
    yazi(ctx, (dizi?.ad ?? '').toLocaleUpperCase(p.dil ?? 'tr'), W / 2, cy, yatay ? 120 : 96, { c: RENK.altin, a: b });
    yazi(ctx, `${M.bolumK} ${bolum?.no ?? ''}`, W / 2, cy + (yatay ? 110 : 140), 70, { a: eo(pr(t, 0.5, 1.1)) * a, w: 500 });
    yazi(ctx, bolum?.ad ?? '', W / 2, cy + (yatay ? 200 : 250), 64, { a: eo(pr(t, 0.8, 1.4)) * a, it: true, w: 500 });
  }

  // Kapanış: devamı + soru
  if (kapanisVar) {
    const v = t - (dur - KAPANIS_SN);
    const a = eo(pr(v, 0, 0.5));
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#04060C'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const cy = yatay ? H * 0.32 : 720;
    const bas = kapanis.baslik ?? M.devami;
    ctx.save(); ctx.font = `700 110px ${serif}`; const bw = ctx.measureText(bas).width; ctx.restore();
    yazi(ctx, bas, W / 2, cy, Math.min(110, Math.floor((110 * W * 0.9) / Math.max(1, bw))), { c: RENK.altin, a });
    yazi(ctx, kapanis.sonraki ?? '', W / 2, cy + 110, 62, { a });
    if (kapanis.soru) {
      const sat = satirla(ctx, kapanis.soru, 60, yatay ? 1400 : 880, false).slice(0, 3);
      sat.forEach((s, j) => yazi(ctx, s, W / 2, cy + 280 + j * 76, 60, { a: eo(pr(v, 0.5, 1)) }));
      yazi(ctx, M.yorum, W / 2, cy + 340 + sat.length * 76, 50, { c: RENK.altin, a: eo(pr(v, 0.9, 1.4)), w: 500 });
    }
  }
}

export function Dizi(props) {
  const { scenes, narration, music, musicVolume, sfx } = props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const ref = useRef(null);
  const ready = useFontReady();
  const t = frame / fps;
  const fns = useMemo(() => scenes.map((s) => {
    try { return s.cizim ? derle(s.cizim) : null; } catch { return null; }
  }), [scenes]);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    kare(ctx, { ...props, width, height }, t, durationInFrames / fps, fns);
  }, [ready, frame, props, fns]);
  const musicVol = (f) => (musicVolume ?? 0.12) * interpolate(f, [0, 45, durationInFrames - 60, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: RENK.gece }}>
      <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />
      {narration ? <Html5Audio src={staticFile(narration)} /> : null}
      {music ? <Html5Audio src={staticFile(music)} volume={musicVol} loop /> : null}
      {sfx ? <Html5Audio src={staticFile(sfx)} volume={0.35} loop /> : null}
    </AbsoluteFill>
  );
}

// Tek kare önizleme ve kapak: bir sahneyi verilen anda çizer.
export function DiziKare(props) {
  const ref = useRef(null);
  const ready = useFontReady();
  const W = props.width ?? 1080;
  const H = props.height ?? 1920;
  const fns = useMemo(() => (props.scenes ?? []).map((s) => {
    try { return s.cizim ? derle(s.cizim) : null; } catch { return null; }
  }), [props.scenes]);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    kare(ctx, { words: [], ...props, width: W, height: H }, props.t ?? 4, props.dur ?? 60, fns);
    // Kapak yazısı: sol tarafta dev, kalın, iki renkli satırlar (karakterler sağ yarıda durur)
    if (props.kapakYazi?.length) {
      const satirlar = props.kapakYazi;
      const boy = Math.min(H * 0.26, (W * 0.5) / Math.max(...satirlar.map((s) => s.length)) * 1.6);
      const y0 = H / 2 - ((satirlar.length - 1) * boy * 1.02) / 2 + boy * 0.35;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W * 0.55, H); ctx.restore();
      satirlar.forEach((s, i) => {
        ctx.save(); ctx.font = `900 ${boy}px ${serif}`; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
        ctx.lineWidth = boy * 0.12; ctx.strokeStyle = '#000'; ctx.strokeText(s, W * 0.04, y0 + i * boy * 1.02);
        ctx.fillStyle = i === satirlar.length - 1 ? '#F2B45A' : '#FFFFFF'; ctx.fillText(s, W * 0.04, y0 + i * boy * 1.02); ctx.restore();
      });
    }
  }, [ready, props, fns]);
  return <canvas ref={ref} width={W} height={H} />;
}
