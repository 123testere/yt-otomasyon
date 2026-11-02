// "Ülkeler Ligi" maçı: 195 ülke gerçek veriyle yarışır, elenir, tek bayrak kalır.
// Her bölüm (phase) anlatımın bir cümle grubuna denk gelir; süreleri motor seslendirmeden hesaplar.
import {
  AbsoluteFill, Html5Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { Captions } from './VideoComposition.jsx';
import { body, display } from './fonts.js';

const NAVY = '#0B1230';
const GOLD = '#FFD23F';
const WHITE = '#F5F5F0';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const fmt = (n, lang) => Math.round(n).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
const outline = (px) => ({ WebkitTextStroke: `${px}px #000`, paintOrder: 'stroke fill' });

// Bayraklı, gözlü yuvarlak karakter.
export function Ball({ iso2, flags, size, grey = 0, look = 0, style }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box',
        border: `${Math.max(2, size * 0.05)}px solid #0a0a0a`, background: '#888',
        filter: `grayscale(${grey}) brightness(${1 - grey * 0.45})`,
        boxShadow: 'inset -10px -14px 0 rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.45)',
      }}>
        <Img src={staticFile(`${flags}/${iso2}.svg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {[0.3, 0.58].map((x, i) => (
        <div key={i} style={{
          position: 'absolute', left: size * x, top: size * 0.3, width: size * 0.16, height: size * 0.22,
          borderRadius: '50%', background: '#fff', border: `${Math.max(1, size * 0.02)}px solid #000`,
        }}>
          <div style={{
            position: 'absolute', width: '50%', height: '50%', borderRadius: '50%', background: '#000',
            left: `${25 + look * 20}%`, top: '35%',
          }} />
        </div>
      ))}
    </div>
  );
}

function Stadium() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 15%, #22348A 0%, ${NAVY} 60%, #050816 100%)` }}>
      {[-1, 1].map((side) => (
        <div key={side} style={{
          position: 'absolute', top: -200, left: side < 0 ? -100 : 700, width: 500, height: 1600,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.10), transparent 70%)',
          transform: `rotate(${side * (18 + 4 * Math.sin(frame / 40))}deg)`, transformOrigin: 'top center',
        }} />
      ))}
    </AbsoluteFill>
  );
}

function Header({ brand, match }) {
  return (
    <div style={{
      position: 'absolute', top: 70, left: 0, right: 0, display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        background: GOLD, color: NAVY, fontFamily: display, fontSize: 52, padding: '8px 34px',
        borderRadius: 12, letterSpacing: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}>
        {brand} · MAÇ {match}
      </div>
    </div>
  );
}

const pop = (frame, fps, delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 150 } });

function Intro({ d, data, flags, lang }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [first, second, third, fourth, fifth] = data.ranked;
  const top = third ?? first;
  const bottom = [first, second, fourth, fifth].filter(Boolean);
  const q = data.question.toLocaleUpperCase(lang).split(' ');
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ marginTop: 220, width: 960, textAlign: 'center', fontFamily: display, fontSize: 96, lineHeight: 1.02, ...outline(8) }}>
        {q.map((w, i) => (
          <span key={i} style={{ display: 'inline-block', margin: '0 0.15em', color: i >= q.length - 2 ? GOLD : WHITE, opacity: pop(frame, fps, i * 3), transform: `translateY(${(1 - pop(frame, fps, i * 3)) * 40}px)` }}>{w}</span>
        ))}
      </div>
      <div style={{ position: 'relative', marginTop: 30, fontSize: 230, transform: `scale(${pop(frame, fps, 10)}) rotate(${Math.sin(frame / 8) * 6}deg)` }}>
        {data.emoji}
        <div style={{ position: 'absolute', right: -70, top: -10, fontFamily: display, fontSize: 150, color: GOLD, ...outline(8) }}>?</div>
      </div>
      <div style={{ marginTop: 10, transform: `scale(${pop(frame, fps, 18)})` }}>
        <Ball iso2={top.iso2} flags={flags} size={190} look={Math.sin(frame / 10)} />
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
        {bottom.map((c, i) => (
          <div key={c.iso2} style={{ transform: `scale(${pop(frame, fps, 22 + i * 3)})` }}>
            <Ball iso2={c.iso2} flags={flags} size={150} look={Math.sin(frame / 12 + i)} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Counter({ from, to, d, label }) {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [0, d * 0.75], [from, to], { ...clamp, easing: (t) => 1 - (1 - t) ** 2 }));
  return (
    <div style={{ position: 'absolute', top: 190, left: 0, right: 0, textAlign: 'center' }}>
      <div style={{ fontFamily: display, fontSize: 190, color: GOLD, lineHeight: 1, ...outline(10) }}>{n}</div>
      <div style={{ fontFamily: body, fontSize: 46, color: WHITE, ...outline(5) }}>{label}</div>
    </div>
  );
}

// Izgara: elenen ülkeler gri olup düşer. order: elenme sırası (önce elenen önce).
function Grid({ countries, eliminated, d, cols, size, flags, top }) {
  const frame = useCurrentFrame();
  const order = new Map(eliminated.map((iso2, i) => [iso2, i]));
  const gap = 10;
  const width = cols * size + (cols - 1) * gap;
  return (
    <div style={{ position: 'absolute', top, left: (1080 - width) / 2, width, display: 'flex', flexWrap: 'wrap', gap }}>
      {countries.map((c) => {
        const k = order.get(c.iso2);
        const at = 6 + ((k ?? 0) / Math.max(1, eliminated.length)) * d * 0.7;
        const p = k === undefined ? 0 : interpolate(frame, [at, at + 8], [0, 1], clamp);
        return (
          <div key={c.iso2} style={{ width: size, height: size, transform: `translateY(${p * 80}px) scale(${1 - p * 0.7})`, opacity: 1 - p }}>
            <Ball iso2={c.iso2} flags={flags} size={size} grey={p} />
          </div>
        );
      })}
    </div>
  );
}

function NoData({ d, data, flags }) {
  return (
    <AbsoluteFill>
      <Counter from={195} to={data.ranked.length} d={d} label={`VERİ YOK: ${data.noData.length} ÜLKE ELENDİ`} />
      <Grid countries={data.all} eliminated={data.noData} d={d} cols={14} size={54} flags={flags} top={470} />
    </AbsoluteFill>
  );
}

function Rounds({ d, data, flags }) {
  const survivors = data.ranked;
  const out = survivors.slice(10).map((c) => c.iso2).reverse(); // en düşükten başlayarak
  const cols = survivors.length > 48 ? 9 : 8;
  return (
    <AbsoluteFill>
      <Counter from={survivors.length} to={Math.min(10, survivors.length)} d={d} label="ÜLKE KALDI" />
      <Grid countries={survivors} eliminated={out} d={d} cols={cols} size={96} flags={flags} top={480} />
    </AbsoluteFill>
  );
}

function Top10({ d, data, flags, lang, unit }) {
  const frame = useCurrentFrame();
  const top = data.ranked.slice(0, 10);
  const max = top[0].value;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 200, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 90, color: GOLD, ...outline(8) }}>İLK 10</div>
      {top.map((c, i) => {
        const grow = interpolate(frame, [i * 2, i * 2 + 20], [0, 1], clamp);
        // 10.'dan 3.'ye doğru sırayla elenir; ilk iki finale kalır.
        const elimAt = d * 0.35 + ((9 - i) / 8) * d * 0.5;
        const g = i >= 2 ? interpolate(frame, [elimAt, elimAt + 8], [0, 1], clamp) : 0;
        const bronze = i === 2 && g > 0.5;
        return (
          <div key={c.iso2} style={{ position: 'absolute', top: 330 + i * 96, left: 60, right: 60, display: 'flex', alignItems: 'center', gap: 18, opacity: 1 - g * 0.6 }}>
            <div style={{ width: 54, fontFamily: display, fontSize: 52, color: WHITE, textAlign: 'right' }}>{i + 1}</div>
            <Ball iso2={c.iso2} flags={flags} size={78} grey={g} />
            <div style={{ flex: 1, position: 'relative', height: 70 }}>
              <div style={{ position: 'absolute', inset: 0, width: `${(c.value / max) * 100 * grow}%`, background: i < 2 ? GOLD : '#4C6FFF', borderRadius: 10, filter: `grayscale(${g})` }} />
              <div style={{ position: 'absolute', left: 16, top: 6, fontFamily: body, fontSize: 36, color: i < 2 ? NAVY : WHITE, whiteSpace: 'nowrap' }}>
                {c.name} · {fmt(c.value * grow, lang)} {unit}{bronze ? ' 🥉' : ''}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function Final({ d, data, flags, lang, unit }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [a, b] = data.ranked;
  // Sayaç sona doğru yavaşlar: son tike kadar izlet.
  const p = interpolate(frame, [6, d - 4], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 4 });
  const side = (c, x, delay) => (
    <div style={{ position: 'absolute', top: 560, left: x, width: 440, textAlign: 'center', transform: `scale(${pop(frame, fps, delay)})` }}>
      <Ball iso2={c.iso2} flags={flags} size={330} look={x < 400 ? 0.8 : -0.8} style={{ margin: '0 auto' }} />
      <div style={{ fontFamily: display, fontSize: 64, color: WHITE, marginTop: 24, ...outline(6) }}>{c.name.toLocaleUpperCase(lang)}</div>
      <div style={{ fontFamily: display, fontSize: 80, color: GOLD, ...outline(7) }}>{fmt(c.value * p, lang)}</div>
      <div style={{ fontFamily: body, fontSize: 36, color: WHITE }}>{unit}</div>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 230, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 110, color: GOLD, ...outline(9) }}>FİNAL</div>
      {side(a, 40, 0)}
      {side(b, 600, 6)}
      <div style={{ position: 'absolute', top: 680, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 120, color: '#FF5A5F', transform: `rotate(-8deg) scale(${pop(frame, fps, 12)})`, ...outline(8) }}>VS</div>
    </AbsoluteFill>
  );
}

function Confetti() {
  const frame = useCurrentFrame();
  return Array.from({ length: 70 }, (_, i) => {
    const x = (i * 157) % 1080;
    const y = ((frame * (6 + (i % 5) * 2)) + i * 53) % 2100 - 200;
    const colors = [GOLD, '#FF5A5F', '#4C6FFF', '#3DDC97', WHITE];
    return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 18, height: 30, background: colors[i % 5], transform: `rotate(${frame * 8 + i * 30}deg)` }} />;
  });
}

function Winner({ data, flags, lang, unit }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = data.ranked[0];
  const s = pop(frame, fps);
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <Confetti />
      <div style={{ marginTop: 200, fontFamily: display, fontSize: 130, color: GOLD, ...outline(10) }}>ŞAMPİYON</div>
      <div style={{ fontSize: 150, marginTop: 0, transform: `translateY(${(1 - s) * -200}px)` }}>👑</div>
      <Ball iso2={w.iso2} flags={flags} size={400} style={{ transform: `scale(${s}) translateY(${Math.sin(frame / 6) * 10}px)` }} />
      <div style={{ marginTop: 30, fontFamily: display, fontSize: 100, color: WHITE, ...outline(8) }}>{w.name.toLocaleUpperCase(lang)}</div>
      <div style={{ fontFamily: display, fontSize: 86, color: GOLD, ...outline(7) }}>{fmt(w.value, lang)} {unit.toLocaleUpperCase(lang)}</div>
    </AbsoluteFill>
  );
}

// Kazananın neden kazandığı: 2-3 kısa gerekçe kartı bölüm boyunca sırayla belirir.
function Why({ d, data, flags, lang }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = data.ranked[0];
  const points = (data.why ?? []).slice(0, 3);
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ marginTop: 210, fontFamily: display, fontSize: 104, color: GOLD, ...outline(9) }}>NEDEN {w.name.toLocaleUpperCase(lang)}?</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginTop: 30 }}>
        <Ball iso2={w.iso2} flags={flags} size={240} look={0.6} style={{ transform: `scale(${pop(frame, fps)})` }} />
        <div style={{ fontSize: 170, transform: `rotate(${Math.sin(frame / 7) * 10}deg) scale(${pop(frame, fps, 6)})` }}>{data.emoji}</div>
      </div>
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 22, width: 900 }}>
        {points.map((text, i) => {
          const s = pop(frame, fps, 10 + i * Math.round((d * 0.6) / Math.max(1, points.length)));
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 22, padding: '18px 28px', borderRadius: 20,
              background: 'rgba(255,255,255,0.12)', border: `3px solid ${GOLD}`, opacity: s, transform: `translateX(${(1 - s) * -300}px)`,
            }}>
              <div style={{ fontFamily: display, fontSize: 54, color: GOLD }}>✓</div>
              <div style={{ fontFamily: body, fontSize: 46, color: WHITE }}>{text}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Table({ data, flags, lang }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 210, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 84, color: GOLD, ...outline(8) }}>
        SEZON {data.season} · PUAN TABLOSU
      </div>
      {data.table.slice(0, 6).map((r, i) => {
        const s = pop(frame, fps, i * 4);
        return (
          <div key={r.iso2} style={{
            position: 'absolute', top: 360 + i * 130, left: 70, right: 70, height: 110, display: 'flex', alignItems: 'center', gap: 24,
            background: i === 0 ? GOLD : 'rgba(255,255,255,0.10)', borderRadius: 20, padding: '0 28px',
            transform: `translateX(${(1 - s) * 400}px)`, opacity: s,
          }}>
            <div style={{ fontFamily: display, fontSize: 60, width: 60, color: i === 0 ? NAVY : WHITE }}>{i + 1}</div>
            <Ball iso2={r.iso2} flags={flags} size={80} />
            <div style={{ flex: 1, fontFamily: body, fontSize: 44, color: i === 0 ? NAVY : WHITE }}>{r.name}</div>
            <div style={{ fontFamily: display, fontSize: 64, color: i === 0 ? NAVY : GOLD }}>{r.points}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', top: 1140, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 56, color: GOLD, ...outline(6) }}>
        SIRADAKİ KONUYU YORUMA YAZ 👇
      </div>
    </AbsoluteFill>
  );
}

const PHASES = { intro: Intro, nodata: NoData, rounds: Rounds, top10: Top10, final: Final, winner: Winner, why: Why, table: Table };

export function League(props) {
  const { phases, data, flags, words, narration, music, musicVolume, lang, brand, match, captionColor } = props;
  const { durationInFrames } = useVideoConfig();
  const musicVol = (f) => musicVolume * interpolate(f, [0, 30, durationInFrames - 60, durationInFrames], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Stadium />
      {phases.map((p) => {
        const Comp = PHASES[p.type];
        return (
          <Sequence key={p.type} from={p.from} durationInFrames={p.duration}>
            <Comp d={p.duration} data={data} flags={flags} lang={lang} unit={data.unit} />
          </Sequence>
        );
      })}
      <Header brand={brand} match={match} />
      {/* Shorts arayüzü alttan ~%20'yi kapatır; altyazı onun hemen üstünde, sahneler 1400 px'in üstünde kalır. */}
      <Captions words={words} mode="kelime" color={captionColor ?? GOLD} portrait lang={lang} bottomOverride={400} />
      {narration ? <Html5Audio src={staticFile(narration)} /> : null}
      {music ? <Html5Audio src={staticFile(music)} volume={musicVol} loop /> : null}
    </AbsoluteFill>
  );
}
