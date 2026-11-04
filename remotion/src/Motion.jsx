// Kodla çizilen hareketli grafikler. Claude her sahne için `visual.motion` verisi yazar;
// burada o veri animasyonlu bir bileşene dönüşür. Her sahne tek bir iş yapar.
import { createContext, useContext } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { body, display } from './fonts.js';

const WHITE = '#F5F5F0';

const pop = (frame, fps, delay = 0, config = { damping: 14, stiffness: 160 }) =>
  spring({ frame: frame - delay, fps, config });

const fade = (frame, from, to) => interpolate(frame, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// Metin uzunluğuna göre yazı boyutu.
const fit = (text, max, min, perChar) => Math.max(min, Math.min(max, Math.floor(perChar / Math.max(4, String(text).length))));

const outline = (px) => ({ WebkitTextStroke: `${px}px rgba(0,0,0,0.85)`, paintOrder: 'stroke fill' });

// Grafiklerin görünümü. Varsayılan: video üstünde beyaz, konturlu yazı. Ansiklopedi teması bunu kâğıt ve mürekkeple değiştirir.
export const MotionTheme = createContext({
  fg: WHITE, onAccent: '#111', card: 'rgba(255,255,255,0.12)', cardBorder: 'rgba(255,255,255,0.5)', dotBorder: '#111',
  outline, display, body, upper: true, glow: true, backdrop: () => <Dim />,
  stage: { portrait: '360px 70px 760px', landscape: '90px 160px 240px' },
});
const useTheme = () => useContext(MotionTheme);
const caps = (th, text, lang) => (th.upper ? String(text).toLocaleUpperCase(lang) : String(text));

// Grafiklerin okunması için arka planı karartır; video bölümü hareketli kalır.
function Dim() {
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%)' }} />;
}

// Grafiklerin yerleşeceği alan: dikeyde kanca yazısı ile altyazı arasında, yatayda ortada.
function Stage({ children, portrait }) {
  const th = useTheme();
  return (
    <AbsoluteFill style={{
      justifyContent: 'center', alignItems: 'center',
      padding: portrait ? th.stage.portrait : th.stage.landscape,
    }}>
      {children}
    </AbsoluteFill>
  );
}

function Stat({ value, label, accent, lang, portrait }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  const numeric = /^[\d.,]+$/.test(String(value)) ? Number(String(value).replace(/\./g, '').replace(',', '.')) : null;
  const progress = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp', easing: (t) => 1 - (1 - t) ** 3 });
  const shown = numeric !== null && !/[.,]/.test(String(value))
    ? Math.round(numeric * progress).toString()
    : String(value);
  const s = pop(frame, fps);
  return (
    <div style={{ textAlign: 'center', transform: `scale(${0.6 + 0.4 * s})`, opacity: s }}>
      <div style={{ fontFamily: th.display, fontSize: fit(value, portrait ? 300 : 280, 140, 1400), color: accent, lineHeight: 1, ...th.outline(10) }}>
        {shown}
      </div>
      <div style={{ height: 12, background: accent, borderRadius: 6, margin: '28px auto', width: `${60 * fade(frame, 15, 40)}%` }} />
      {label ? (
        <div style={{ fontFamily: th.body, fontSize: portrait ? 62 : 56, color: th.fg, opacity: fade(frame, 18, 32), ...th.outline(6) }}>
          {caps(th, label, lang)}
        </div>
      ) : null}
    </div>
  );
}

// Noktalar sabit boyutlu bir yuvaya oturur; çizgi yuvanın tam ortasından geçer, böylece hiza animasyondan etkilenmez.
const SLOT = 72;
const YEAR_H = 96; // yatay düzende yıl yazısının yüksekliği

function Timeline({ items, highlight, accent, portrait }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  const list = (items ?? []).slice(0, 4);
  const line = fade(frame, 0, 25);
  const vertical = portrait;
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 56 : 0 }}>
      <div style={{
        position: 'absolute', background: th.fg, opacity: 0.9, borderRadius: 4,
        ...(vertical
          ? { left: SLOT / 2 - 4, top: 0, width: 8, height: `${line * 100}%` }
          : { top: YEAR_H + SLOT / 2 - 4, left: 0, height: 8, width: `${line * 100}%` }),
      }} />
      {list.map((it, i) => {
        const s = pop(frame, fps, 12 + i * 14);
        const hot = i === (highlight ?? list.length - 1);
        const year = <div style={{ fontFamily: th.display, fontSize: vertical ? 120 : YEAR_H, height: vertical ? 'auto' : YEAR_H, color: hot ? accent : th.fg, lineHeight: 1, ...th.outline(8) }}>{it.year}</div>;
        const label = <div style={{ fontFamily: th.body, fontSize: vertical ? 52 : 40, color: th.fg, marginTop: 8, maxWidth: vertical ? 800 : 400, ...th.outline(5) }}>{it.label}</div>;
        return vertical ? (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 36, opacity: s, transform: `translateX(${(1 - s) * 80}px)`, zIndex: 1 }}>
            <Dot hot={hot} accent={accent} />
            <div>{year}{label}</div>
          </div>
        ) : (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', opacity: s, transform: `translateY(${(1 - s) * 40}px)`, zIndex: 1 }}>
            {year}
            <Dot hot={hot} accent={accent} />
            {label}
          </div>
        );
      })}
    </div>
  );
}

function Dot({ hot, accent }) {
  const th = useTheme();
  const size = hot ? 64 : 46;
  return (
    <div style={{ width: SLOT, height: SLOT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', boxSizing: 'border-box',
        background: hot ? accent : th.fg, border: `8px solid ${th.dotBorder}`, boxShadow: hot && th.glow ? `0 0 40px ${accent}` : 'none',
      }} />
    </div>
  );
}

function Compare({ left, right, accent, lang, portrait }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  const a = pop(frame, fps, 0);
  const b = pop(frame, fps, 10);
  const vs = pop(frame, fps, 20, { damping: 8, stiffness: 200 });
  const card = (side, s, from, hot) => (
    <div style={{
      flex: 1, padding: '40px 30px', borderRadius: 28, textAlign: 'center',
      background: hot ? accent : th.card, border: `4px solid ${hot ? accent : th.cardBorder}`,
      transform: `translate${portrait ? 'Y' : 'X'}(${(1 - s) * from}px)`, opacity: s,
    }}>
      <div style={{ fontFamily: th.display, fontSize: fit(side?.value ?? '', 170, 80, 900), color: hot ? th.onAccent : th.fg, lineHeight: 1 }}>{side?.value}</div>
      <div style={{ fontFamily: th.body, fontSize: 46, color: hot ? th.onAccent : th.fg, marginTop: 14 }}>{caps(th, side?.title ?? '', lang)}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: 30, width: '100%' }}>
      {card(left, a, -300, false)}
      <div style={{ fontFamily: th.display, fontSize: 110, color: accent, transform: `scale(${vs}) rotate(-6deg)`, ...th.outline(8) }}>VS</div>
      {card(right, b, 300, true)}
    </div>
  );
}

function List({ title, items, accent, lang }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  return (
    <div style={{ width: '100%' }}>
      {title ? (
        <div style={{ fontFamily: th.display, fontSize: 96, color: accent, marginBottom: 30, opacity: fade(frame, 0, 12), ...th.outline(8) }}>
          {caps(th, title, lang)}
        </div>
      ) : null}
      {(items ?? []).slice(0, 4).map((it, i) => {
        const s = pop(frame, fps, 10 + i * 12);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 26, opacity: s, transform: `translateX(${(1 - s) * -120}px)` }}>
            <div style={{
              width: 84, height: 84, borderRadius: 20, background: accent, color: th.onAccent, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: th.display, fontSize: 60,
            }}>{i + 1}</div>
            <div style={{ fontFamily: th.body, fontSize: 56, color: th.fg, lineHeight: 1.15, ...th.outline(5) }}>{it}</div>
          </div>
        );
      })}
    </div>
  );
}

// Kelime kelime beliren büyük başlık.
function Title({ text, sub, accent, lang }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  const words = caps(th, text ?? '', lang).split(/\s+/);
  const size = fit(text, 170, 90, 2200);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: th.display, fontSize: size, lineHeight: 1.05, color: th.fg, ...th.outline(10) }}>
        {words.map((w, i) => {
          const s = pop(frame, fps, i * 4);
          return (
            <span key={i} style={{ display: 'inline-block', margin: '0 0.18em', opacity: s, transform: `translateY(${(1 - s) * 60}px)`, color: i === words.length - 1 ? accent : th.fg }}>
              {w}
            </span>
          );
        })}
      </div>
      {sub ? <div style={{ fontFamily: th.body, fontSize: 52, color: th.fg, marginTop: 30, opacity: fade(frame, words.length * 4 + 6, words.length * 4 + 18), ...th.outline(5) }}>{sub}</div> : null}
    </div>
  );
}

function Question({ text, accent }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 0, { damping: 7, stiffness: 120 });
  const pulse = 1 + 0.06 * Math.sin(frame / 5);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: th.display, fontSize: 420, lineHeight: 0.9, color: accent, transform: `scale(${s * pulse}) rotate(${(1 - s) * -30}deg)`, textShadow: th.glow ? `0 0 60px ${accent}88` : 'none' }}>?</div>
      <div style={{ fontFamily: th.body, fontSize: fit(text, 70, 46, 2600), color: th.fg, marginTop: 30, opacity: fade(frame, 10, 24), ...th.outline(6) }}>{text}</div>
    </div>
  );
}

function Quote({ text, author, accent }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const chars = Math.floor(interpolate(frame, [6, 6 + String(text ?? '').length * 0.9], [0, String(text ?? '').length], { extrapolateRight: 'clamp' }));
  return (
    <div style={{ textAlign: 'left', width: '100%' }}>
      <div style={{ fontFamily: th.display, fontSize: 260, lineHeight: 0.6, color: accent, opacity: fade(frame, 0, 8) }}>“</div>
      <div style={{ fontFamily: th.body, fontSize: fit(text, 74, 48, 3200), color: th.fg, lineHeight: 1.25, ...th.outline(5) }}>
        {String(text ?? '').slice(0, chars)}
      </div>
      {author ? <div style={{ fontFamily: th.body, fontSize: 44, color: accent, marginTop: 26, opacity: fade(frame, 30, 45) }}>— {author}</div> : null}
    </div>
  );
}

function Icon({ emoji, text, accent, lang }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 0, { damping: 6, stiffness: 140 });
  const float = Math.sin(frame / 10) * 12;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 300, transform: `scale(${s}) translateY(${float}px)`, filter: th.glow ? 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' : 'none' }}>{emoji}</div>
      {text ? <div style={{ fontFamily: th.display, fontSize: fit(text, 120, 70, 1500), color: accent, marginTop: 20, opacity: fade(frame, 8, 20), ...th.outline(8) }}>{caps(th, text, lang)}</div> : null}
    </div>
  );
}

const COMPONENTS = { stat: Stat, timeline: Timeline, compare: Compare, list: List, title: Title, question: Question, quote: Quote, icon: Icon };

export function MotionScene({ motion, accent, lang, portrait }) {
  const frame = useCurrentFrame();
  const th = useTheme();
  const { durationInFrames } = useVideoConfig();
  const Comp = COMPONENTS[motion?.type];
  if (!Comp) return null;
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {th.backdrop()}
      <Stage portrait={portrait}>
        <Comp {...motion} accent={accent} lang={lang} portrait={portrait} />
      </Stage>
    </AbsoluteFill>
  );
}

// Dış görsel kullanılmayan "Hareketli grafik" stilinde sahne zemini: yavaşça akan renk geçişleri ve parçacıklar.
export function AnimatedBackground({ accent, seed = 0 }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const a = (frame / 3 + seed * 40) % 360;
  const dots = Array.from({ length: 26 }, (_, i) => {
    const r = (Math.sin(i * 12.9898 + seed) * 43758.5453) % 1;
    const x = Math.abs(r) * width;
    const speed = 0.4 + (i % 5) * 0.25;
    const y = height - ((frame * speed * 3 + i * 137) % (height + 200));
    return { x, y, size: 6 + (i % 4) * 5, o: 0.15 + (i % 3) * 0.12 };
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${a}deg, #0d0f1a 0%, #1b1f3a 45%, ${accent}55 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + 30 * Math.sin(frame / 60)}% ${40 + 20 * Math.cos(frame / 70)}%, ${accent}40 0%, transparent 55%)` }} />
      {dots.map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: d.x, top: d.y, width: d.size, height: d.size, borderRadius: '50%', background: accent, opacity: d.o }} />
      ))}
    </AbsoluteFill>
  );
}
