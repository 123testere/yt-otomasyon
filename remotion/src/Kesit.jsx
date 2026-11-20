// Yayın kesiti Shorts'u (Vice City Dispatch): ortada yayın görüntüsü, arkada bulanık kopyası,
// üstte kanca yazısı, altta yorum altyazısı ve yayıncı kredisi. Yorum konuşurken yayın sesi kısılır.
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, display } from './fonts.js';

const KAM = { y: 330, h: 640 }; // bölünmüş ekranda kamera kutusu (1080x640)

const konusuyor = (yorumlar, t) => yorumlar.some((y) => t >= y.t0 - 0.15 && t <= y.t0 + y.d);

function Kanca({ metin, accent }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', top: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${0.85 + 0.15 * s})` }}>
      <div style={{
        maxWidth: 940, fontFamily: display, fontSize: 88, lineHeight: 1.12, color: '#fff', textTransform: 'uppercase', textAlign: 'center',
        background: '#000', padding: '18px 34px', border: `7px solid ${accent}`, borderRadius: 18,
      }}>{metin}</div>
    </div>
  );
}

// Kelime kelime altyazı: o an söylenen kelime vurgulu, 3-4 kelimelik gruplar
function Altyazi({ words, t, accent, top = 1300 }) {
  // son başlayan kelime; kelime aralarında yazı kaybolmasın (söylendikten 0,6 sn sonrasına kadar kalır)
  let i = -1;
  words.forEach((w, k) => { if (w.t <= t) i = k; });
  if (i < 0 || t > words[i].t + words[i].d + 0.6) return null;
  const bas = Math.floor(i / 3) * 3;
  const grup = words.slice(bas, bas + 3);
  return (
    <div style={{ position: 'absolute', top, left: 50, right: 50, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22, rowGap: 4 }}>
      {grup.map((w, k) => (
        <span key={k} style={{
          fontFamily: body, fontSize: 76, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.15,
          color: bas + k === i ? accent : '#fff', WebkitTextStroke: '10px #000', paintOrder: 'stroke fill',
        }}>{w.text}</span>
      ))}
    </div>
  );
}

export function Kesit({ video, hook, kredi, yorumlar = [], altyazi = [], kamera = null, cta = null, kisma = 0.22, accent = '#FF2E88' }) {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = f / fps;
  // Yorum sesi varsa onun altyazısı, yoksa yayıncının kendi konuşması
  const words = yorumlar.length ? yorumlar.flatMap((y) => y.words) : altyazi;
  const ctaBas = durationInFrames / fps - 2.5;
  const hacim = (fr) => (konusuyor(yorumlar, fr / fps) ? kisma : 1);
  const hookSon = Math.min(durationInFrames, Math.round(3.2 * fps));
  const kapanis = yorumlar.find((y) => y.kapanis);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {video && (
        <>
          <AbsoluteFill style={{ filter: 'blur(38px) brightness(0.45)', transform: 'scale(1.25)' }}>
            <OffthreadVideo src={staticFile(video)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </AbsoluteFill>
          {kamera ? (
            <>
              {/* Bölünmüş ekran: üstte yayıncının kamerası büyütülmüş (sessiz kopya), altta oyun */}
              <div style={{ position: 'absolute', top: KAM.y, left: 0, width: 1080, height: KAM.h, overflow: 'hidden', borderBottom: `6px solid ${accent}` }}>
                <OffthreadVideo src={staticFile(video)} muted style={{
                  position: 'absolute', width: 1080 / kamera.w, height: (1080 / kamera.w) * 9 / 16,
                  left: -kamera.x * (1080 / kamera.w), top: -kamera.y * (1080 / kamera.w) * 9 / 16,
                }} />
              </div>
              <div style={{ position: 'absolute', top: KAM.y + KAM.h, left: 0, width: 1080, height: 608, overflow: 'hidden' }}>
                <OffthreadVideo src={staticFile(video)} volume={hacim} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </>
          ) : (
            <div style={{ position: 'absolute', top: 520, left: 0, width: 1080, height: 720, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
              <OffthreadVideo src={staticFile(video)} volume={hacim} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </>
      )}
      {hook && <Sequence durationInFrames={hookSon}><Kanca metin={hook} accent={accent} /></Sequence>}
      {yorumlar.map((y, i) => (
        <Sequence key={i} from={Math.round(y.t0 * fps)} durationInFrames={Math.max(1, Math.round(y.d * fps))}>
          <Audio src={staticFile(y.ses)} />
        </Sequence>
      ))}
      <Altyazi words={words} t={t} accent={accent} top={kamera ? KAM.y + KAM.h - 70 : 1300} />
      {(kapanis ? t >= kapanis.t0 : cta && t >= ctaBas) && (
        <div style={{
          position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 70, color: '#fff',
          opacity: interpolate(t - (kapanis?.t0 ?? ctaBas), [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <span style={{ background: accent, padding: '8px 26px' }}>{cta ?? 'SUBSCRIBE FOR PART 2'}</span>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 210, left: 0, right: 0, textAlign: 'center', fontFamily: body, fontWeight: 800, fontSize: 38, color: '#fff',
      }}>
        <span style={{ background: 'rgba(0,0,0,.65)', padding: '10px 24px', borderRadius: 40, borderLeft: `8px solid ${accent}` }}>🎮 {kredi}</span>
      </div>
    </AbsoluteFill>
  );
}
