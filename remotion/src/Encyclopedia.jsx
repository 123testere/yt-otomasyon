// Lamba Altında — "Ansiklopedi" teması: akşam, masa lambasının altında açılmış eski bir ansiklopedi sayfası.
// Renkler kanalın paletinden (Claude Youtube/kanal/lamba-altinda/PALET.md); Nur Bey nurbey.js ile kodla çizilir.
import { useLayoutEffect, useRef } from 'react';
import {
  AbsoluteFill, Html5Audio, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { drawNurBey } from './nurbey.js';
import { serif } from './fonts.js';
import { MotionScene, MotionTheme } from './Motion.jsx';
import { Captions } from './VideoComposition.jsx';

export const PALET = {
  kagit: '#F3EAD7', kagitGolge: '#E6DBC4', murekkep: '#2B2A33', soluk: '#6B6252', gece: '#1E1C24',
  lamba: '#E8A33D', amberKoyu: '#9A5B12', bordo: '#7A2E24', pirinc: '#B8893B', teknikMavi: '#1F2B57',
};

const TRANSITION = 12;
const HOOK_FRAMES = 75;
const CILT = 600;
const MOTION_MAX_SEC = 4; // grafik en fazla bu kadar kalır, sonra levha görünür // yatay düzende sol sayfa ile sağ sayfa arasındaki cilt çizgisi

// Yerleşim: yatayda Nur Bey sol sayfada, levha ve grafikler sağ sayfada. Dikeyde levha üstte, Nur Bey altında.
export const LAYOUT = {
  landscape: {
    plate: { left: 680, top: 90, width: 1160, height: 640 },
    nur: { x: 300, y: 1000, s: 0.95, yon: 1 },
    stage: '90px 70px 330px 680px',
    captions: { bottom: 70, padLeft: CILT },
  },
  portrait: {
    plate: { left: 70, top: 290, width: 940, height: 660 },
    nur: { x: 820, y: 1300, s: 0.72, yon: -1 },
    stage: '290px 70px 900px',
    captions: { bottom: 420, padLeft: 0 },
  },
};

// Deterministik titreme (nurbey.js ile aynı): saniyede 6 "kaynama".
const h = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
const wob = (i, t, a) => (h(i * 13.7 + Math.floor(t * 6) * 7.3) - 0.5) * 2 * a;

// Kâğıt: gren, satır çizgileri, kenar kararması; yatayda cilt çizgisi.
export function Paper({ night = false }) {
  const ref = useRef(null);
  const { width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.fillStyle = night ? PALET.gece : PALET.kagit;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = night ? `rgba(255,240,210,${h(i * 7.7) * 0.035})` : `rgba(90,70,40,${h(i * 7.7) * 0.06})`;
      ctx.fillRect(h(i) * width, h(i * 3.1) * height, 2, 2);
    }
    if (night) return;
    ctx.strokeStyle = 'rgba(43,42,51,0.07)';
    ctx.lineWidth = 1;
    for (let y = 60; y < height; y += 34) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(width - 40, y); ctx.stroke(); }
    const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(80,55,20,.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    if (width > height) {
      ctx.strokeStyle = 'rgba(43,42,51,.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(CILT, 70); ctx.lineTo(CILT, height - 70); ctx.stroke();
    }
  }, [night, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
}

// Titreyen mürekkep çerçeve (SVG), kenar boyunca her 40 pikselde bir nokta.
function InkFrame({ width, height, t, color = PALET.murekkep, seed = 0 }) {
  const pts = [];
  const edge = (x0, y0, x1, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40));
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  edge(0, 0, width, 0); edge(width, 0, width, height); edge(width, height, 0, height); edge(0, height, 0, 0);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + wob(i + seed, t, 1.6)).toFixed(1)},${(y + wob(i + seed + 91, t, 1.6)).toFixed(1)}`).join(' ') + 'Z';
  return (
    <svg width={width + 20} height={height + 20} style={{ position: 'absolute', left: -10, top: -10, overflow: 'visible' }}>
      <path d={d} transform="translate(10 10)" fill="none" stroke={color} strokeWidth={3.4} strokeLinejoin="round" />
    </svg>
  );
}

// Fotoğraf ya da çizim, kâğıda basılmış levha gibi: sepya, kâğıtla çarpılır, yavaş yakınlaşır.
function Plate({ scene, index, box, duration }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (scene.kind === 'none') return null;
  const p = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: 'clamp' });
  const scale = index % 2 ? 1.08 - 0.08 * p : 1 + 0.08 * p;
  const media = {
    width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`,
    filter: 'grayscale(1) sepia(0.35) contrast(1.15) brightness(1.03)', mixBlendMode: 'multiply',
  };
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', ...box }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: PALET.kagitGolge }}>
          {scene.kind === 'video' ? (
            <Loop durationInFrames={Math.max(1, scene.clipFrames ?? scene.duration)}>
              <OffthreadVideo src={staticFile(scene.src)} muted style={media} />
            </Loop>
          ) : <Img src={staticFile(scene.src)} style={media} />}
        </div>
        <InkFrame width={box.width} height={box.height} t={frame / fps} seed={index * 17} />
        <div style={{ position: 'absolute', left: 0, top: box.height + 14, fontFamily: serif, fontStyle: 'italic', fontWeight: 500, fontSize: 30, color: PALET.soluk }}>
          Şekil {index + 1}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Plates({ scenes, box }) {
  const presentations = [slide({ direction: 'from-right' }), fade()];
  return (
    <TransitionSeries>
      {scenes.flatMap((scene, i) => {
        const last = i === scenes.length - 1;
        const items = [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={scene.duration + (last ? 0 : TRANSITION)}>
            <Plate scene={scene} index={i} box={box} duration={scene.duration + TRANSITION} />
          </TransitionSeries.Sequence>,
        ];
        if (!last) {
          items.push(<TransitionSeries.Transition key={`t${i}`} presentation={presentations[i % presentations.length]}
            timing={linearTiming({ durationInFrames: TRANSITION })} />);
        }
        return items;
      })}
    </TransitionSeries>
  );
}

// Ekrandaki grafiğe göre Nur Bey'in ifadesi; grafik varken ona işaret eder.
const IFADE_OF = { stat: 'saskin', question: 'merakli', compare: 'merakli', quote: 'dusunceli', title: 'gururlu', icon: 'gulumsuyor' };

export function NurBey({ x, y, s, yon, ifade = 'anlatiyor', poz = 'dik', konusuyor = false, isik = null, t }) {
  const ref = useRef(null);
  const { width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    drawNurBey(ctx, { x, y, s, yon, t, ifade, poz, konusuyor, isik, koni: true });
  });
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
}

function Narrator({ words, motions, layout, hook }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const speaking = words.some((w) => t >= w.t && t < w.t + w.d + 0.05);
  const motion = motions.find((m) => frame >= m.from && frame < m.from + m.duration)?.motion;
  const ifade = hook ? 'merakli' : (motion ? IFADE_OF[motion.type] ?? 'anlatiyor' : 'anlatiyor');
  return <NurBey {...layout.nur} t={t} ifade={ifade} poz={motion ? 'isaret' : 'dik'} konusuyor={speaking} isik={hook ? 1 : null} />;
}

// İlk 2,5 sn: gece zemini, lamba ışığında soru (paletin kuralı: kanca ve kapanış gece zemininde, vurgu lamba ışığı).
function NightHook({ text, portrait, lang }) {
  const frame = useCurrentFrame();
  if (frame > HOOK_FRAMES) return null;
  const out = interpolate(frame, [HOOK_FRAMES - 12, HOOK_FRAMES], [1, 0], { extrapolateLeft: 'clamp' });
  const rise = interpolate(frame, [0, 14], [30, 0], { extrapolateRight: 'clamp' });
  const box = portrait ? { left: 70, right: 70, top: 300, height: 720 } : { left: 680, right: 70, top: 90, height: 640 };
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Paper night />
      {text ? (
        <div style={{ position: 'absolute', ...box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            fontFamily: serif, fontWeight: 700, fontSize: portrait ? 104 : 112, lineHeight: 1.1, textAlign: 'center',
            color: PALET.lamba, transform: `translateY(${rise}px)`, opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {text.toLocaleUpperCase(lang).replace(/\?$/, '')}{/\?$/.test(text) ? '?' : ''}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

const paperMotionTheme = {
  fg: PALET.murekkep, onAccent: PALET.kagit, card: PALET.kagitGolge, cardBorder: 'rgba(43,42,51,0.35)', dotBorder: PALET.murekkep,
  outline: () => ({}), display: serif, body: serif, upper: false, glow: false,
  backdrop: () => <Paper />,
  stage: { portrait: LAYOUT.portrait.stage, landscape: LAYOUT.landscape.stage },
};

export function Encyclopedia(props) {
  const { scenes, words, narration, music, musicVolume, captions, hookText, portrait, lang } = props;
  const { fps, durationInFrames } = useVideoConfig();
  const layout = portrait ? LAYOUT.portrait : LAYOUT.landscape;
  const motions = (props.motions ?? []).map((m) => ({ ...m, duration: Math.min(m.duration, MOTION_MAX_SEC * fps) }));
  const frame = useCurrentFrame();
  const hooking = Boolean(hookText) && frame <= HOOK_FRAMES;
  const musicVol = (f) => musicVolume * interpolate(f, [0, 60, durationInFrames - 90, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: PALET.kagit }}>
      <Paper />
      <Plates scenes={scenes} box={layout.plate} />
      <MotionTheme.Provider value={paperMotionTheme}>
        {motions.map((m, i) => (
          <Sequence key={i} from={m.from} durationInFrames={m.duration}>
            <MotionScene motion={m.motion} accent={PALET.amberKoyu} lang={lang} portrait={portrait} />
          </Sequence>
        ))}
      </MotionTheme.Provider>
      <NightHook text={hookText} portrait={portrait} lang={lang} />
      <Narrator words={words} motions={motions} layout={layout} hook={hooking} />
      {/* Gece zemininde mürekkep yazı okunmaz; kanca sırasında altyazı yok. */}
      {hooking ? null : <Captions words={words} mode={captions} color={PALET.amberKoyu} portrait={portrait} lang={lang}
        bottomOverride={layout.captions.bottom}
        look={{ font: serif, color: PALET.murekkep, upper: false, size: portrait ? 76 : 58, padLeft: layout.captions.padLeft }} />}
      {narration ? <Html5Audio src={staticFile(narration)} /> : null}
      {music ? <Html5Audio src={staticFile(music)} volume={musicVol} loop /> : null}
    </AbsoluteFill>
  );
}

// Kapak (1280x720): gece zemini, sağda sepya levha, solda lamba ışığında Nur Bey ve büyük yazı; son satır lamba ışığı renginde.
export function EncyclopediaThumb({ background, text, lang }) {
  const lines = wrapWords(String(text ?? '').toLocaleUpperCase(lang), 12, 3);
  const longest = Math.max(...lines.map((l) => l.length), 4);
  const size = Math.floor(Math.max(70, Math.min(120, 600 / (longest * 0.62), 330 / lines.length)));
  const box = { left: 660, top: 70, width: 560, height: 560 };
  return (
    <AbsoluteFill>
      <Paper night />
      {background ? (
        <div style={{ position: 'absolute', ...box, transform: 'rotate(2deg)', backgroundColor: PALET.kagit, padding: 18, boxSizing: 'border-box' }}>
          <Img src={staticFile(background)} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: 'grayscale(1) sepia(0.35) contrast(1.2)', mixBlendMode: 'multiply',
          }} />
        </div>
      ) : null}
      <NurBey x={190} y={700} s={0.62} yon={1} t={0.4} ifade="saskin" isik={1} />
      <div style={{ position: 'absolute', left: 50, top: 50, width: 600, fontFamily: serif, fontWeight: 700, fontSize: size, lineHeight: 1.05 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: i === lines.length - 1 ? PALET.lamba : PALET.kagit }}>{line}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function wrapWords(text, maxChars, maxLines) {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines);
}
