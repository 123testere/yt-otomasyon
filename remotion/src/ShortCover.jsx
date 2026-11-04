import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { display, serif } from './fonts.js';
import { drawNurBey } from './nurbey.js';

// Lamba Altında kapağında altta lamba ışığında Nur Bey.
function NurBeyAlt() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, 1080, 1920);
    drawNurBey(ctx, { x: 300, y: 1800, s: 1.05, t: 0.4, ifade: 'saskin', isik: 1, koni: true });
  }, []);
  return <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', inset: 0 }} />;
}

// Shorts küçük resmi (1080x1920): videodan bir kare, üstünde dev ve kalın kanca yazısı; son satır vurgu kutusunda.
// Yazı kırpılmasın diye dikey kapağın ortasındaki kareye (üst %20 – alt %30 arası) yerleşir.
function wrap(text, maxChars, maxLines) {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines);
}

export function ShortCover({ background, text, badge, lang, accent, theme }) {
  const paper = theme === 'ansiklopedi';
  const lines = wrap(String(text ?? '').toLocaleUpperCase(lang), paper ? 11 : 10, 4);
  const longest = Math.max(...lines.map((l) => l.length), 3);
  // Anton harfi ~0,48 em, Lora kalın ~0,62 em genişliğinde.
  const size = Math.floor(Math.min(paper ? 170 : 230, 960 / (longest * (paper ? 0.62 : 0.5)), 900 / lines.length));
  const font = paper ? serif : display;
  const ink = paper ? '#F3EAD7' : '#fff';
  const hot = paper ? '#E8A33D' : accent;
  return (
    <AbsoluteFill style={{ backgroundColor: paper ? '#1E1C24' : '#111' }}>
      {background ? (
        <Img src={staticFile(background)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: paper ? 'none' : 'saturate(1.2) contrast(1.1)' }} />
      ) : null}
      {paper ? <NurBeyAlt /> : (
        <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.3) 100%)' }} />
      )}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '380px 50px 560px' }}>
        {badge ? (
          <div style={{
            fontFamily: font, fontWeight: paper ? 700 : 400, fontSize: 58, color: '#111', backgroundColor: hot,
            padding: '6px 28px', borderRadius: 12, marginBottom: 40, letterSpacing: 2,
          }}>{badge}</div>
        ) : null}
        {lines.map((line, i) => {
          const last = i === lines.length - 1 && lines.length > 1;
          return (
            <div key={i} style={{
              fontFamily: font, fontWeight: paper ? 700 : 400, fontSize: size, lineHeight: 1.12, textAlign: 'center',
              color: last ? '#111' : ink,
              backgroundColor: last ? hot : 'transparent',
              padding: last ? '4px 26px 10px' : 0, borderRadius: last ? 16 : 0, marginTop: last ? Math.round(size * 0.18) : 0,
              transform: last ? 'rotate(-2deg)' : 'none',
              WebkitTextStroke: last ? '0' : `${Math.round(size / 16)}px #000`, paintOrder: 'stroke fill',
              textShadow: last ? 'none' : '0 10px 30px rgba(0,0,0,0.8)',
              boxShadow: last ? '0 18px 40px rgba(0,0,0,0.55)' : 'none',
            }}>{line}</div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
