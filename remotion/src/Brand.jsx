// Kanal kimliği: banner (2560x1440) ve profil fotoğrafı (800x800). Uygulamadaki kurulum sihirbazı ister.
// Banner'da yazı, her cihazda görünen orta güvenli alanda (1546x423) durur.
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { display, serif } from './fonts.js';
import { drawNurBey } from './nurbey.js';
import { cop } from '../../shared/cop.js';

// Çöp adam karakter (keşif kanallarının kimliği: dizinin ana karakteri)
function CopKarakter({ width, height, def, x, y, s, poz = 'el-salla' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    cop(ctx, def, { x, y, s, yon: 1, t: 0.6, poz, pozU: 1, ifade: 'gulumsuyor', agiz: 0, solgun: 0, seed: def.seed ?? 1, esya: def.esya ?? null });
  }, [width, height, def, x, y, s, poz]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
}

const GECE = '#1E1C24';

function NurBey({ width, height, x, y, s }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    drawNurBey(ctx, { x, y, s, t: 0.4, ifade: 'gulumsuyor', isik: 1, koni: true });
  }, [width, height, x, y, s]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
}

export function Banner({ title, tagline, accent, theme, karakter, renkler }) {
  if (karakter) {
    const [a = '#1F2937', b = accent ?? '#F97316', c = '#F9FAFB'] = renkler ?? [];
    const boy = Math.min(170, Math.floor(1150 / (Math.max(String(title).length, 6) * 0.5)));
    return (
      <AbsoluteFill style={{ background: `linear-gradient(120deg, ${a} 0%, ${a} 45%, ${b} 140%)` }}>
        <AbsoluteFill style={{ background: `radial-gradient(circle at 36% 62%, ${b}55, transparent 40%)` }} />
        <CopKarakter width={2560} height={1440} def={karakter} x={880} y={1130} s={1.6} poz="zafer" />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 1080 }}>
          <div style={{ fontFamily: display, fontSize: boy, lineHeight: 1, color: c }}>{title}</div>
          {tagline ? <div style={{ fontFamily: display, fontSize: 56, marginTop: 22, color: b, letterSpacing: 3 }}>{String(tagline).toLocaleUpperCase('tr')}</div> : null}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const paper = theme === 'ansiklopedi';
  const size = Math.min(paper ? 140 : 170, Math.floor(1300 / (Math.max(String(title).length, 6) * (paper ? 0.55 : 0.48))));
  return (
    <AbsoluteFill style={{ backgroundColor: paper ? GECE : '#0E1015' }}>
      {paper ? (
        <>
          <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 38% 60%, rgba(232,163,61,0.22), transparent 55%)' }} />
          <NurBey width={2560} height={1440} x={600} y={940} s={0.85} />
        </>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${accent}44 0%, transparent 60%), linear-gradient(135deg, #0E1015 0%, #1B1F3A 100%)` }} />
      )}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: paper ? 500 : 0 }}>
        <div style={{
          fontFamily: paper ? serif : display, fontWeight: paper ? 700 : 400, fontSize: size, lineHeight: 1,
          color: paper ? '#F3EAD7' : '#fff', textAlign: 'center',
        }}>{title}</div>
        {tagline ? (
          <div style={{
            fontFamily: paper ? serif : display, fontStyle: paper ? 'italic' : 'normal', fontWeight: paper ? 500 : 400,
            fontSize: 58, marginTop: 24, color: paper ? '#E8A33D' : accent, letterSpacing: paper ? 0 : 3,
          }}>{paper ? tagline : String(tagline).toLocaleUpperCase('tr')}</div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Avatar({ title, accent, theme, karakter, renkler }) {
  if (karakter) {
    const [a = '#1F2937', b = accent ?? '#F97316'] = renkler ?? [];
    return (
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${b} 0%, ${a} 72%)` }}>
        <CopKarakter width={800} height={800} def={karakter} x={335} y={1260} s={1.85} poz="dur" />
      </AbsoluteFill>
    );
  }
  if (theme === 'ansiklopedi') {
    return (
      <AbsoluteFill style={{ backgroundColor: GECE }}>
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 55%, rgba(232,163,61,0.35), transparent 60%)' }} />
        <NurBey width={800} height={800} x={340} y={700} s={1.15} />
      </AbsoluteFill>
    );
  }
  const initials = String(title).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toLocaleUpperCase('tr');
  return (
    <AbsoluteFill style={{ backgroundColor: accent, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: display, fontSize: 380, color: '#111', lineHeight: 1 }}>{initials}</div>
    </AbsoluteFill>
  );
}
