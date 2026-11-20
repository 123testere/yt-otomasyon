// Lamba Altında — "Ansiklopedi" teması. Eski elle yapılan videolarla aynı düzen (Claude Youtube/projeler):
// Shorts: gece zemini, üstte iki satır başlık, ortada kâğıt kartta çizim, ilerleme çubuğu, altta Nur Bey ve altyazı kutusu.
// Uzun video: giriş gece zemininde; sonra kâğıt sayfa, solda Nur Bey, sağda bölüm başlığı ve çizim, altta altyazı kutusu.
// Sahne çizimleri senaryodaki `cizim` kodundan gelir (shared/cizim.js kiti); Nur Bey nurbey.js ile çizilir.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AbsoluteFill, continueRender, delayRender, Html5Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { drawNurBey } from './nurbey.js';
import { serif, serifReady } from './fonts.js';
import { ALAN, KAPAK_ALAN, PALET as K, derle, eo, h, kit, pr } from '../../shared/cizim.js';

const GECIS = 0.35; // sahneler arası yumuşak geçiş (sn)
const SAYFA_GECIS = 0.6; // girişten kâğıt sayfaya geçiş (sn)

// Shorts (1080x1920) — bagimsiz.js ölçüleri.
const S = { kart: { x: 40, y: 400, w: 1000, h: 740 }, cizim: { x: 40, y: 420, s: 1 }, nur: { x: 190, y: 1540, s: 0.74 } };
// Uzun video (1920x1080) — sahneler.js ölçüleri; cilt çizgisi x=600.
const L = {
  cilt: 600, nur: { x: 300, y: 1000, s: 0.95 },
  cizim: { x: 800, y: 250, s: 0.9 }, // 900x630, sağ sayfa
  giris: { x: 960, y: 470, s: 0.62 }, // gece zemininde, başlığın altında
};

function grain(ctx, w, hh, gece, n) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = gece ? `rgba(255,240,210,${h(i * 7.7) * 0.04})` : `rgba(90,70,40,${h(i * 7.7) * 0.06})`;
    ctx.fillRect(h(i) * w, h(i * 3.1) * hh, 2, 2);
  }
}

function geceZemin(ctx, W, H) {
  ctx.fillStyle = K.gece; ctx.fillRect(0, 0, W, H); grain(ctx, W, H, true, 9000);
}

function sayfaZemin(ctx, W, H, cilt) {
  ctx.fillStyle = K.kagit; ctx.fillRect(0, 0, W, H); grain(ctx, W, H, false, 9000);
  ctx.strokeStyle = 'rgba(43,42,51,0.06)'; ctx.lineWidth = 1;
  for (let y = 60; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke(); }
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(80,55,20,.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (cilt) { ctx.strokeStyle = 'rgba(43,42,51,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cilt, 70); ctx.lineTo(cilt, H - 70); ctx.stroke(); }
}

function kartZemin(ctx, k) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 18); ctx.clip();
  ctx.fillStyle = K.kagit; ctx.fillRect(k.x, k.y, k.w, k.h);
  ctx.translate(k.x, k.y); grain(ctx, k.w, k.h, false, 5000);
  ctx.strokeStyle = 'rgba(43,42,51,.06)'; ctx.lineWidth = 1;
  for (let y = 40; y < k.h; y += 36) { ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(k.w - 24, y); ctx.stroke(); }
  const g = ctx.createRadialGradient(k.w / 2, k.h / 2, k.h * 0.3, k.w / 2, k.h / 2, k.h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(80,55,20,.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, k.w, k.h);
  ctx.restore();
}

function yazi(ctx, s, x, y, size, { c = K.m, a = 1, al = 'center', w = 700, it = false } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = c; ctx.font = `${it ? 'italic ' : ''}${w} ${size}px ${serif}`;
  ctx.textAlign = al; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); ctx.restore();
}

// Bir sahnenin çizimini yerine koyar. Hata olursa o sahne boş kalır, video yine çıkar.
function sahneCiz(ctx, fn, yer, t, u, a, gece) {
  if (!fn || a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(yer.x, yer.y); ctx.scale(yer.s, yer.s);
  ctx.beginPath(); ctx.rect(-20, -20, ALAN.w + 40, ALAN.h + 40); ctx.clip();
  try { fn(kit(ctx, t, { font: serif, gece }), u); } catch { /* hatalı çizim: sahne boş */ }
  ctx.restore();
}

// Aktif sahne ve bir önceki (geçiş için).
function sahneDurumu(scenes, t) {
  let i = 0;
  for (let k = 0; k < scenes.length; k++) if (t >= scenes[k].t0) i = k;
  const gecis = i > 0 ? pr(t, scenes[i].t0, scenes[i].t0 + GECIS) : 1;
  return { i, gecis };
}

// Altyazı: cümle sonlarında ya da karakter sınırında bölünen kelime grupları.
function altyaziGruplari(words, maxChars) {
  const groups = [];
  let cur = [];
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0);
    if (cur.length && len + w.text.length > maxChars) { groups.push(cur); cur = []; }
    cur.push(w);
    if (/[.!?…:]$/.test(w.text)) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => ({ t0: g[0].t, metin: g.map((w) => w.text).join(' '), next: groups[i + 1]?.[0].t }));
}

function satirla(ctx, metin, size, maxW) {
  ctx.font = `700 ${size}px ${serif}`;
  const sat = [];
  let cur = '';
  for (const w of metin.split(' ')) {
    const tr = `${cur} ${w}`.trim();
    if (ctx.measureText(tr).width > maxW && cur) { sat.push(cur); cur = w; } else cur = tr;
  }
  if (cur) sat.push(cur);
  return sat;
}

// Ön gösterim kartı: "TAMAMI" + yayın saati + yanıp sönen ok (izleyiciyi uzun videoya çağırır)
function onGosterimKarti(ctx, u, kapanis, T) {
  const a = eo(pr(u, 0, 0.5)), k = S.kart;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(30,28,36,.94)';
  ctx.beginPath(); ctx.roundRect(k.x, k.y - 200, k.w, k.h + 200, 18); ctx.fill(); ctx.restore();
  yazi(ctx, 'TAMAMI', 540, 360, 110, { c: K.lamba, a });
  const b = eo(pr(u, 0.3, 0.8)) * (1 + 0.04 * Math.sin(T * 6));
  yazi(ctx, kapanis.baslik, 540, 560, 96, { c: K.kagit, a: eo(pr(u, 0.3, 0.8)), w: 900 });
  yazi(ctx, kapanis.alt || 'Uzun videoda, bu kanalda', 540, 680, 58, { c: K.kagit, a: eo(pr(u, 0.6, 1.1)), it: true, w: 500 });
  ctx.save(); ctx.globalAlpha = eo(pr(u, 0.8, 1.2)); ctx.fillStyle = K.lamba;
  const oy = 820 + Math.sin(T * 5) * 14 * b;
  ctx.beginPath(); ctx.moveTo(470, oy); ctx.lineTo(610, oy); ctx.lineTo(540, oy + 80); ctx.closePath(); ctx.fill(); ctx.restore();
  yazi(ctx, 'Devamı için abone ol ve beğen', 540, 1090, 54, { c: K.kagit, a: eo(pr(u, 1.2, 1.7)), w: 700 });
}

// Kişisel soru kartı: izleyicinin kendi hayatına dair tek soru ("Sizin evde hâlâ var mı?"): oylamadan çok yorum getirir
function soruKarti(ctx, u, kapanis, T) {
  const a = eo(pr(u, 0, 0.5)), k = S.kart;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(30,28,36,.94)';
  ctx.beginPath(); ctx.roundRect(k.x, k.y - 200, k.w, k.h + 200, 18); ctx.fill(); ctx.restore();
  // Soru kartın içinde, satırlar dengeli (tek kelime alt satıra düşmesin diye geniş satır)
  const boy = kapanis.soru.length > 34 ? 70 : 78;
  ctx.save(); ctx.font = `800 ${boy}px ${serif}`;
  const sat = satirla(ctx, kapanis.soru, boy, 960, false).slice(0, 4);
  ctx.restore();
  const y0 = 560 - (sat.length - 1) * boy * 0.62;
  sat.forEach((s, j) => yazi(ctx, s, 540, y0 + j * boy * 1.24, boy, { c: K.kagit, a, w: 800 }));
  const y = y0 + sat.length * boy * 1.24 + 50;
  yazi(ctx, kapanis.alt || 'Yorumlara yaz 👇', 540, y, 64, { c: K.lamba, a: eo(pr(u, 0.4, 0.9)) * (1 + 0.04 * Math.sin(T * 5)), w: 700 });
  yazi(ctx, 'Devamı için abone ol ve beğen', 540, 1090, 54, { c: K.kagit, a: eo(pr(u, 1.0, 1.5)), w: 700 });
}

function kapanisKarti(ctx, u, kapanis, T) {
  if (kapanis.fragman) return onGosterimKarti(ctx, u, kapanis, T);
  if (!kapanis.a && kapanis.soru) return soruKarti(ctx, u, kapanis, T);
  const a = eo(pr(u, 0, 0.5)), k = S.kart;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(30,28,36,.94)';
  ctx.beginPath(); ctx.roundRect(k.x, k.y - 200, k.w, k.h + 200, 18); ctx.fill(); ctx.restore();
  yazi(ctx, kapanis.soru || 'Sırada hangisi olsun?', 540, 330, 70, { c: K.kagit, a });
  [[kapanis.a, 290], [kapanis.b, 790]].forEach(([s, x], i) => {
    const b = eo(pr(u, 0.3 + i * 0.25, 0.8 + i * 0.25));
    ctx.save(); ctx.globalAlpha = b; ctx.strokeStyle = K.lamba; ctx.lineWidth = 5; ctx.fillStyle = 'rgba(232,163,61,.12)';
    ctx.beginPath(); ctx.roundRect(x - 220, 520, 440, 320, 30); ctx.fill(); ctx.stroke(); ctx.restore();
    yazi(ctx, i ? 'B' : 'A', x, 640, 90, { c: K.lamba, a: b });
    yazi(ctx, String(s ?? ''), x, 760, String(s ?? '').length > 10 ? 46 : 62, { c: K.kagit, a: b });
  });
  yazi(ctx, 'Yorumlara yazın', 540, 960, 66, { c: K.lamba, a: eo(pr(u, 1, 1.5)) });
  // Abone ol / beğen çağrısı (oylama kartının altında)
  yazi(ctx, 'Devamı için abone ol ve beğen', 540, 1090, 54, { c: K.kagit, a: eo(pr(u, 1.2, 1.7)), w: 700 });
  const o = eo(pr(u, 1.2, 1.8)), dx = Math.sin(T * 5) * 8;
  const kt = kit(ctx, T, { font: serif });
  yazi(ctx, 'yorum düğmesi', 820, 1250, 36, { c: K.kagit, a: o, w: 500, it: true });
  ctx.save(); ctx.globalAlpha = o;
  kt.ink([[860 + dx, 1280], [940 + dx, 1320], [1000 + dx, 1360]], { w: 8, c: K.lamba, amp: 0.5 });
  kt.ink([[962 + dx, 1328], [1004 + dx, 1362], [952 + dx, 1376]], { w: 8, c: K.lamba, amp: 0.5 });
  ctx.restore();
}

// İlk sahnenin çizimi ilk karede tamamen çizilmiş görünür (izleyici kaydırıp kaydırmamaya o an karar verir);
// sonraki sahneler kalemle çizilerek belirir.
const ILK_HAZIR = 2.5;
const sahneU = (scenes, k, t) => Math.max(0, t - scenes[k].t0) + (k === 0 ? ILK_HAZIR : 0);

// Seri rozeti: "MARKALARIN HİKÂYESİ #3" / "EŞYALARIN HİKÂYESİ #54" (izleyici bir seriyi takip ettiğini görsün)
function rozetCiz(ctx, rozet, x, y, boy, a = 1) {
  if (!rozet || a <= 0) return;
  const s = String(rozet).toLocaleUpperCase('tr');
  ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${boy}px ${serif}`;
  const w = ctx.measureText(s).width + boy * 1.6;
  ctx.fillStyle = 'rgba(232,163,61,.16)'; ctx.strokeStyle = K.lamba; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - boy * 1.05, w, boy * 1.6, boy * 0.8); ctx.fill(); ctx.stroke();
  ctx.restore();
  yazi(ctx, s, x, y, boy, { c: K.lamba, a, w: 800 });
}

function kisaKare(ctx, p, t, d) {
  const { scenes, fns, words, baslik, kapanis } = p;
  geceZemin(ctx, 1080, 1920);
  const son = scenes.length - 1;
  const kT = kapanis && son > 0 ? scenes[son].t0 : Infinity;
  const ba = t < kT ? 1 : 1 - pr(t, kT, kT + 0.4);
  rozetCiz(ctx, p.rozet, 540, 130, 34, ba);
  yazi(ctx, baslik?.[0] ?? '', 540, 240, 86, { c: K.kagit, a: ba });
  yazi(ctx, baslik?.[1] ?? '', 540, 340, 86, { c: K.lamba, a: ba });
  kartZemin(ctx, S.kart);
  const k = S.kart;
  ctx.save(); ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 18); ctx.clip();
  const { i, gecis } = sahneDurumu(scenes, t);
  if (gecis < 1 && i > 0) sahneCiz(ctx, fns[i - 1], S.cizim, t, sahneU(scenes, i - 1, t), 1 - gecis, false);
  sahneCiz(ctx, fns[i], S.cizim, t, sahneU(scenes, i, t), gecis, false);
  ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(184,137,59,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 18); ctx.stroke(); ctx.restore();
  const bitis = Number.isFinite(kT) ? kT : d;
  ctx.fillStyle = 'rgba(243,234,215,.15)'; ctx.fillRect(k.x, k.y + k.h + 18, k.w, 8);
  ctx.fillStyle = K.lamba; ctx.fillRect(k.x, k.y + k.h + 18, k.w * Math.min(1, t / bitis), 8);
  if (t >= kT) kapanisKarti(ctx, t - kT, kapanis, t);
  const ifade = t >= kT ? 'merakli' : scenes[i].ifade || 'anlatiyor';
  const konusuyor = words.some((w) => t >= w.t && t < w.t + w.d + 0.05);
  drawNurBey(ctx, { ...S.nur, t, ifade, konusuyor, isik: 0.9, koni: true });
  if (t < kT) {
    const g = altyaziGruplari(words, 70).find((q) => t >= q.t0 && (q.next === undefined || t < q.next));
    if (g) {
      const sat = satirla(ctx, g.metin, 54, 600).slice(0, 3);
      const y0 = 1320 - (sat.length - 1) * 34;
      ctx.save(); ctx.fillStyle = 'rgba(30,28,36,.78)'; ctx.beginPath(); ctx.roundRect(400, y0 - 60, 640, sat.length * 68 + 36, 14); ctx.fill(); ctx.restore();
      sat.forEach((r, j) => yazi(ctx, r, 420, y0 + j * 68, 54, { c: K.kagit, al: 'left' }));
    }
  }
}

function uzunKare(ctx, p, t) {
  const { scenes, fns, words, baslik } = p;
  const ilkBolum = scenes.findIndex((s) => s.bolum);
  const sayfaT = ilkBolum >= 0 ? scenes[ilkBolum].t0 : 0;
  const sayfa = ilkBolum < 0 ? 1 : pr(t, sayfaT, sayfaT + SAYFA_GECIS);
  const { i, gecis } = sahneDurumu(scenes, t);
  const girisSahne = (k) => ilkBolum > 0 && k < ilkBolum;

  geceZemin(ctx, 1920, 1080);
  // Giriş: gece zemininde başlık ve kâğıt renginde çizim.
  if (sayfa < 1) {
    ctx.save(); ctx.globalAlpha = 1 - sayfa;
    rozetCiz(ctx, p.rozet, 1270, 210, 34);
    yazi(ctx, baslik?.[0] ?? '', 1270, 330, 92, { c: K.kagit });
    yazi(ctx, baslik?.[1] ?? '', 1270, 450, 92, { c: K.lamba });
    if (girisSahne(i)) {
      if (gecis < 1 && i > 0) sahneCiz(ctx, fns[i - 1], L.giris, t, sahneU(scenes, i - 1, t), 1 - gecis, true);
      sahneCiz(ctx, fns[i], L.giris, t, sahneU(scenes, i, t), gecis, true);
    }
    ctx.restore();
  }
  if (sayfa > 0) {
    ctx.save(); ctx.globalAlpha = sayfa;
    sayfaZemin(ctx, 1920, 1080, L.cilt);
    // Bölüm başlığı: o ana kadarki son bölüm.
    let b = null, bT = 0;
    for (let k = 0; k <= i; k++) if (scenes[k].bolum) { b = scenes[k].bolum; bT = scenes[k].t0; }
    if (b) {
      const u = t - bT, a = eo(pr(u, 0.2, 1.2));
      yazi(ctx, [b.no, b.ust].filter(Boolean).join(' · '), 640, 112, 30, { c: K.s, a, w: 500, it: true, al: 'left' });
      yazi(ctx, b.ad ?? '', 640, 186, 68, { a, al: 'left' });
      const kt = kit(ctx, t, { font: serif });
      ctx.save(); ctx.globalAlpha *= a; kt.ink(kt.ln([640, 210], [640 + 560 * eo(pr(u, 0.6, 1.8)), 210], 10), { w: 2.4, c: K.ak, seed: 900 }); ctx.restore();
    }
    if (!girisSahne(i)) {
      if (gecis < 1 && i > 0 && !girisSahne(i - 1)) sahneCiz(ctx, fns[i - 1], L.cizim, t, t - scenes[i - 1].t0, 1 - gecis, false);
      sahneCiz(ctx, fns[i], L.cizim, t, Math.max(0, t - scenes[i].t0), gecis, false);
    }
    ctx.restore();
  }
  const konusuyor = words.some((w) => t >= w.t && t < w.t + w.d + 0.05);
  drawNurBey(ctx, { ...L.nur, t, ifade: scenes[i].ifade || 'anlatiyor', konusuyor, isik: 0.9, koni: true });

  const g = altyaziGruplari(words, 80).find((q) => t >= q.t0 && (q.next === undefined || t < q.next));
  if (g) {
    const sat = satirla(ctx, g.metin, 46, 1000).slice(0, 2);
    if (sayfa >= 1) {
      const hh = sat.length * 60 + 36, y0 = 1060 - hh;
      ctx.save(); ctx.fillStyle = 'rgba(251,246,234,.92)'; ctx.strokeStyle = 'rgba(43,42,51,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(690, y0, 1080, hh, 12); ctx.fill(); ctx.stroke(); ctx.restore();
      sat.forEach((r, j) => yazi(ctx, r, 1230, y0 + 58 + j * 60, 46, { c: K.m }));
    } else {
      sat.forEach((r, j) => yazi(ctx, r, 1270, 1000 - (sat.length - 1 - j) * 56, 44, { c: K.kagit, w: 500 }));
    }
  }
}

// Lora yüklenene kadar render bekler; sonra tuval yeniden çizilir.
function useFontReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender('Lora');
    serifReady.then(() => { setReady(true); continueRender(handle); });
  }, []);
  return ready;
}

// Görsel sahneleri (ara sıra): çizim alanında, kâğıda basılmış levha gibi.
function Levha({ scene, yer, a }) {
  if (!scene?.img || a <= 0) return null;
  const w = ALAN.w * yer.s, hh = ALAN.h * yer.s;
  return (
    <div style={{ position: 'absolute', left: yer.x + 20, top: yer.y + 20, width: w - 40, height: hh - 40, opacity: a, overflow: 'hidden',
      border: `3px solid ${K.m}`, backgroundColor: K.kg }}>
      <Img src={staticFile(scene.img)} style={{
        width: '100%', height: '100%', objectFit: 'cover',
        filter: 'grayscale(1) sepia(0.35) contrast(1.15) brightness(1.03)', mixBlendMode: 'multiply',
      }} />
    </div>
  );
}

export function Encyclopedia(props) {
  const { scenes, narration, music, musicVolume, portrait } = props;
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const ref = useRef(null);
  const ready = useFontReady();
  const t = frame / fps;
  const fns = useMemo(() => scenes.map((s) => {
    try { return s.cizim ? derle(s.cizim) : null; } catch { return null; }
  }), [scenes]);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    if (portrait) kisaKare(ctx, { ...props, fns }, t, durationInFrames / fps);
    else uzunKare(ctx, { ...props, fns }, t);
  }, [ready, frame, props, fns]);
  const { i, gecis } = sahneDurumu(scenes, t);
  const ilkBolum = scenes.findIndex((s) => s.bolum);
  const yer = portrait ? S.cizim : (ilkBolum > 0 && i < ilkBolum ? L.giris : L.cizim);
  const musicVol = (f) => musicVolume * interpolate(f, [0, 60, durationInFrames - 90, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: K.gece }}>
      <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />
      <Levha scene={scenes[i]} yer={yer} a={gecis} />
      {narration ? <Html5Audio src={staticFile(narration)} /> : null}
      {music ? <Html5Audio src={staticFile(music)} volume={musicVol} loop /> : null}
      {props.sesEfekt === false ? null : sesler(scenes, portrait).map((e, k) => (
        <Sequence key={k} from={Math.round(e.t * fps)} durationInFrames={Math.round(1.2 * fps)} layout="none">
          <Html5Audio src={staticFile(`sfx/${e.ses}.wav`)} volume={e.vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

// Efektler: ilk karede kaydırmayı durduran tok vuruş + hızlı geçiş sesi; her yeni çizimde kalemin kâğıtta çizdiği ses;
// ilk 15 sn'de (Shorts'ta her geçişte) hafif hızlı geçiş sesi. Konuşmanın altında kalacak seviyede.
function sesler(scenes, portrait) {
  const ev = [{ t: 0, ses: 'gum', vol: 0.55 }, { t: 0, ses: 'kilic-savurma', vol: 0.35 }];
  scenes.forEach((s, i) => {
    if (i === 0) return;
    ev.push({ t: s.t0, ses: 'kalem', vol: 0.22 });
    if (portrait || s.t0 < 15) ev.push({ t: Math.max(0, s.t0 - 0.12), ses: 'kilic-savurma', vol: 0.16 });
  });
  return ev;
}

// Kapak (1280x720): gece zemini, solda lamba ışığında Nur Bey, ortada kâğıt renginde çizim, sağda büyük yazı.
export function EncyclopediaThumb({ text, sub, cizim, lang }) {
  const ref = useRef(null);
  const ready = useFontReady();
  const fn = useMemo(() => { try { return cizim ? derle(cizim) : null; } catch { return null; } }, [cizim]);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    geceZemin(ctx, 1280, 720);
    const g = ctx.createRadialGradient(240, 420, 20, 240, 420, 640);
    g.addColorStop(0, 'rgba(232,163,61,.28)'); g.addColorStop(1, 'rgba(232,163,61,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    drawNurBey(ctx, { x: 210, y: 690, s: 0.95, t: 0.4, ifade: 'saskin', isik: 1, koni: true });
    if (fn) {
      ctx.save(); ctx.translate(470, 160);
      ctx.beginPath(); ctx.rect(-10, -10, KAPAK_ALAN.w + 20, KAPAK_ALAN.h + 20); ctx.clip();
      try { fn(kit(ctx, 0.4, { font: serif, gece: true, alan: KAPAK_ALAN }), 10); } catch { /* çizimsiz kapak */ }
      ctx.restore();
    }
    const lines = satirlar(String(text ?? '').toLocaleUpperCase(lang), 9, 3);
    const longest = Math.max(...lines.map((l) => l.length), 3);
    const size = Math.floor(Math.max(80, Math.min(190, 500 / (longest * 0.6), 460 / lines.length)));
    const top = 360 - ((lines.length - 1) * size * 1.05) / 2 - (sub ? 30 : 0);
    lines.forEach((l, k) => yazi(ctx, l, 1000, top + k * size * 1.05 + size * 0.35, size, { c: k === 0 ? K.lamba : K.kagit }));
    if (sub) yazi(ctx, sub, 1000, top + lines.length * size * 1.05 + 30, 40, { c: K.kagit, w: 500, it: true });
  }, [ready, fn, text, sub, lang]);
  return <canvas ref={ref} width={1280} height={720} />;
}

function satirlar(text, maxChars, maxLines) {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines);
}
