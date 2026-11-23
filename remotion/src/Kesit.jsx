// Yayın kesiti Shorts'u (Vice City Dispatch).
// Düzen: kamera bulunduysa üstte yayıncının kamerası büyütülmüş, altında oyun; bulunamadıysa tek büyük görüntü.
// Bizim yorumumuz EKRAN YAZISIYLA (kampanyalar yapay zekâ sesini yasaklıyor): üst bölgede sırayla
//   kanca (0-2,5 sn) → bağlam kartı → "şuna bak" işaretleri (+ oyunda çember) → "NEDEN PATLADI" analizi → takip çağrısı.
// Shorts güvenli alanı (S2): yazılar sağ düğmelerin ve alttaki açıklama alanının (alt ~380 px) dışında.
// Eski kullanım (yorum sesi: `yorumlar`) muaf kaynaklar için korunur.
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, display } from './fonts.js';

const UST = { y: 130, h: 160 }; // yorum kartlarının bölgesi (üst)
const BOL = { kam: { y: 300, h: 500 }, oyun: { y: 800, h: 608 } }; // bölünmüş ekran
const TEK = { oyun: { y: 440, h: 720 } }; // tek görüntü
const KAMERA_W = 1080;

const konusuyor = (yorumlar, t) => yorumlar.some((y) => t >= y.t0 - 0.15 && t <= y.t0 + y.d);
const gir = (t, t0) => interpolate(t - t0, [0, 0.25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

function Kanca({ metin, accent, t }) {
  const { fps } = useVideoConfig();
  const s = spring({ frame: Math.round(t * fps), fps, config: { damping: 14, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', top: UST.y, left: 40, right: 40, display: 'flex', justifyContent: 'center', transform: `scale(${0.85 + 0.15 * s})` }}>
      <div style={{
        maxWidth: 980, fontFamily: display, fontSize: 74, lineHeight: 1.08, color: '#fff', textTransform: 'uppercase', textAlign: 'center',
        background: '#000', padding: '14px 30px', border: `7px solid ${accent}`, borderRadius: 18,
      }}>{metin}</div>
    </div>
  );
}

// Üst bölgedeki yorum kartı (bağlam / işaret / analiz / çağrı)
function Kart({ etiket, metin, accent, t, t0, renk = '#000' }) {
  const o = gir(t, t0);
  return (
    <div style={{ position: 'absolute', top: UST.y, left: 40, right: 40, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${(1 - o) * -20}px)` }}>
      <div style={{ maxWidth: 980, background: renk, borderRadius: 20, padding: '14px 28px', borderLeft: `12px solid ${accent}`, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
        {etiket ? <div style={{ fontFamily: body, fontWeight: 800, fontSize: 28, letterSpacing: 2, color: accent, marginBottom: 4 }}>{etiket}</div> : null}
        <div style={{ fontFamily: body, fontWeight: 800, fontSize: 50, lineHeight: 1.12, color: '#fff' }}>{metin}</div>
      </div>
    </div>
  );
}

// Oyun görüntüsünde işaret çemberi (x, y: kaynak karesinde 0-1)
function Cember({ x, y, oyun, kirp, accent, t, t0 }) {
  const o = gir(t, t0);
  const nabiz = 1 + 0.08 * Math.sin((t - t0) * 8);
  const px = kirp ? x * 1280 - 100 : x * 1080;
  const py = oyun.y + y * oyun.h;
  const r = 70;
  return (
    <div style={{
      position: 'absolute', left: px - r, top: py - r, width: r * 2, height: r * 2, borderRadius: '50%',
      border: `8px solid ${accent}`, boxShadow: `0 0 0 4px #000, 0 0 30px ${accent}`, opacity: o, transform: `scale(${nabiz * (0.6 + 0.4 * o)})`,
    }} />
  );
}

// Kelime kelime altyazı: o an söylenen kelime vurgulu, 3'lü gruplar
function Altyazi({ words, t, accent, top }) {
  let i = -1;
  words.forEach((w, k) => { if (w.t <= t) i = k; });
  if (i < 0 || t > words[i].t + words[i].d + 0.6) return null;
  const bas = Math.floor(i / 3) * 3;
  const grup = words.slice(bas, bas + 3);
  return (
    <div style={{ position: 'absolute', top, left: 60, right: 160, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 20, rowGap: 2 }}>
      {grup.map((w, k) => (
        <span key={k} style={{
          fontFamily: body, fontSize: 64, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.12,
          color: bas + k === i ? accent : '#fff', WebkitTextStroke: '9px #000', paintOrder: 'stroke fill',
        }}>{w.text}</span>
      ))}
    </div>
  );
}

export function Kesit({ video, hook, kredi, ekran = null, yorumlar = [], altyazi = [], kamera = null, cta = null, kisma = 0.22, accent = '#FF2E88' }) {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = f / fps;
  const son = durationInFrames / fps;
  const words = yorumlar.length ? yorumlar.flatMap((y) => y.words) : altyazi;
  const hacim = (fr) => (konusuyor(yorumlar, fr / fps) ? kisma : 1);
  const oyun = kamera ? BOL.oyun : TEK.oyun;

  // Üst bölgenin zaman çizelgesi: o an başlamış en son kart görünür
  const kartlar = [];
  if (hook) kartlar.push({ t0: 0, t1: ekran ? 2.6 : 3.2, tur: 'kanca' });
  if (ekran?.baglam) kartlar.push({ t0: 2.6, t1: 6.5, tur: 'baglam', metin: ekran.baglam });
  for (const isr of ekran?.isaretler ?? []) kartlar.push({ t0: isr.sn, t1: isr.sn + 2.8, tur: 'isaret', metin: isr.metin, x: isr.x, y: isr.y });
  const analizBas = Math.max(3, son - 4.6);
  if (ekran?.analiz?.metin) kartlar.push({ t0: analizBas, t1: son - 1.7, tur: 'analiz', metin: ekran.analiz.metin });
  const kapanis = yorumlar.find((y) => y.kapanis);
  if (cta && !kapanis) kartlar.push({ t0: ekran?.analiz ? son - 1.7 : son - 2.5, t1: son + 1, tur: 'cta', metin: cta });
  const aktif = kartlar.filter((k) => t >= k.t0 && t < k.t1).sort((a, b) => b.t0 - a.t0)[0];
  const isaretAktif = kartlar.filter((k) => k.tur === 'isaret' && k.x != null && t >= k.t0 && t < k.t1);

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {video && (
        <>
          <AbsoluteFill style={{ filter: 'blur(38px) brightness(0.4)', transform: 'scale(1.25)' }}>
            <OffthreadVideo src={staticFile(video)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </AbsoluteFill>
          {kamera ? (
            <>
              {/* üstte yayıncının kamerası (sessiz kopya), altta oyun */}
              <div style={{ position: 'absolute', top: BOL.kam.y, left: 0, width: KAMERA_W, height: BOL.kam.h, overflow: 'hidden', borderBottom: `6px solid ${accent}` }}>
                <OffthreadVideo src={staticFile(video)} muted style={{
                  position: 'absolute', width: KAMERA_W / kamera.w, height: (KAMERA_W / kamera.w) * 9 / 16,
                  left: -kamera.x * (KAMERA_W / kamera.w), top: -kamera.y * (KAMERA_W / kamera.w) * 9 / 16,
                }} />
              </div>
              <div style={{ position: 'absolute', top: oyun.y, left: 0, width: 1080, height: oyun.h, overflow: 'hidden' }}>
                <OffthreadVideo src={staticFile(video)} volume={hacim} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </>
          ) : (
            <div style={{ position: 'absolute', top: oyun.y, left: 0, width: 1080, height: oyun.h, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
              <OffthreadVideo src={staticFile(video)} volume={hacim} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </>
      )}
      {isaretAktif.map((k, i) => <Cember key={i} x={k.x} y={k.y} oyun={oyun} kirp={!kamera} accent={accent} t={t} t0={k.t0} />)}
      {yorumlar.map((y, i) => (
        <Sequence key={i} from={Math.round(y.t0 * fps)} durationInFrames={Math.max(1, Math.round(y.d * fps))}>
          <Audio src={staticFile(y.ses)} />
        </Sequence>
      ))}
      <Altyazi words={words} t={t} accent={accent} top={kamera ? BOL.kam.y + BOL.kam.h - 60 : oyun.y + oyun.h + 20} />
      {aktif?.tur === 'kanca' && <Kanca metin={hook} accent={accent} t={t} />}
      {aktif?.tur === 'baglam' && <Kart etiket="CONTEXT" metin={aktif.metin} accent={accent} t={t} t0={aktif.t0} />}
      {aktif?.tur === 'isaret' && <Kart etiket="👀 WATCH" metin={aktif.metin} accent={accent} t={t} t0={aktif.t0} />}
      {aktif?.tur === 'analiz' && <Kart etiket="WHY IT BLEW UP" metin={aktif.metin} accent={accent} t={t} t0={aktif.t0} renk="#111" />}
      {aktif?.tur === 'cta' && <Kart metin={aktif.metin} accent={accent} t={t} t0={aktif.t0} renk={accent} />}
      {kapanis && t >= kapanis.t0 && <Kart metin="SUBSCRIBE FOR PART 2" accent={accent} t={t} t0={kapanis.t0} renk={accent} />}
      <div style={{
        position: 'absolute', top: oyun.y + oyun.h + (kamera ? 22 : 200), left: 60, right: 160, textAlign: 'center',
        fontFamily: body, fontWeight: 800, fontSize: 36, color: '#fff',
      }}>
        <span style={{ background: 'rgba(0,0,0,.7)', padding: '10px 24px', borderRadius: 40, borderLeft: `8px solid ${accent}` }}>🎮 {kredi}</span>
      </div>
    </AbsoluteFill>
  );
}
