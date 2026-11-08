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

export function kare(ctx, p, t, dur, fns) {
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
  if (OYUN_MEKANLAR.includes(sc.mekan)) {
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
  const rozet = `${(dizi?.ad ?? '').toLocaleUpperCase('tr')}${bolum?.toplam ? ` · ${bolum.no}/${bolum.toplam}` : bolum?.no ? ` · BÖLÜM ${bolum.no}` : ''}`;
  if (yatay) yazi(ctx, rozet, 50, 70, 34, { c: RENK.altin, a: kartBitti ? 0.85 : 0, al: 'left' });
  else yazi(ctx, rozet, 540, 150, 40, { c: RENK.altin, a: kartBitti ? 0.9 : 0 });
  if (sc.ozet && kartBitti) yazi(ctx, 'Önceki bölümde…', W / 2, yatay ? 140 : 220, 44, { it: true, w: 500, a: 0.85 });

  // Dev yazı (ör. "30 MİLYON" / "kopya sattı"): sahne boyunca görünür, karakterlerin üstünde
  if (sc.buyukYazi && kartBitti) {
    const a = eo(pr(u, 0.15, 0.55));
    const zip = 1 + (1 - eo(pr(u, 0.15, 0.5))) * 0.4;
    const cy = yatay ? H * 0.3 : 690;
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(zip, zip); ctx.translate(-W / 2, -cy);
    const boy = yatay ? 130 : 120;
    ctx.font = `900 ${boy}px ${serif}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.globalAlpha = a; ctx.lineWidth = boy * 0.14; ctx.strokeStyle = '#000'; ctx.strokeText(sc.buyukYazi.ust, W / 2, cy);
    ctx.fillStyle = '#FFC23A'; ctx.fillText(sc.buyukYazi.ust, W / 2, cy);
    ctx.restore();
    if (sc.buyukYazi.alt) yazi(ctx, sc.buyukYazi.alt, W / 2, cy + (yatay ? 80 : 76), yatay ? 56 : 54, { a, w: 700 });
  }

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
      yazi(ctx, (def.ad ?? g.konusan).toLocaleUpperCase('tr'), (W - genis) / 2, y, boyut * 0.7, { c: acikRenk(def.renk), al: 'left', golge: false });
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
    yazi(ctx, (dizi?.ad ?? '').toLocaleUpperCase('tr'), W / 2, cy, yatay ? 120 : 96, { c: RENK.altin, a: b });
    yazi(ctx, `Bölüm ${bolum?.no ?? ''}`, W / 2, cy + (yatay ? 110 : 140), 70, { a: eo(pr(t, 0.5, 1.1)) * a, w: 500 });
    yazi(ctx, bolum?.ad ?? '', W / 2, cy + (yatay ? 200 : 250), 64, { a: eo(pr(t, 0.8, 1.4)) * a, it: true, w: 500 });
  }

  // Kapanış: devamı + soru
  if (kapanisVar) {
    const v = t - (dur - KAPANIS_SN);
    const a = eo(pr(v, 0, 0.5));
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#04060C'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const cy = yatay ? H * 0.32 : 720;
    yazi(ctx, kapanis.baslik ?? 'DEVAMI', W / 2, cy, 110, { c: RENK.altin, a });
    yazi(ctx, kapanis.sonraki ?? '', W / 2, cy + 110, 62, { a });
    if (kapanis.soru) {
      const sat = satirla(ctx, kapanis.soru, 60, yatay ? 1400 : 880, false).slice(0, 3);
      sat.forEach((s, j) => yazi(ctx, s, W / 2, cy + 280 + j * 76, 60, { a: eo(pr(v, 0.5, 1)) }));
      yazi(ctx, 'Yorumlara yaz 👇', W / 2, cy + 340 + sat.length * 76, 50, { c: RENK.altin, a: eo(pr(v, 0.9, 1.4)), w: 500 });
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
