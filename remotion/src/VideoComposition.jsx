import {
  AbsoluteFill, Html5Audio, Img, interpolate, Loop, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { body, display } from './fonts.js';

const TRANSITION = 12; // kare (~0,4 sn)
const HOOK_FRAMES = 75; // kanca yazısı ilk 2,5 sn

// Fotoğrafa yavaş yakınlaşma/kaydırma; sahneden sahneye yön değişir.
function KenBurns({ src, index, duration }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: 'clamp' });
  const mode = index % 3;
  const scale = mode === 1 ? 1.18 - 0.18 * p : 1 + 0.18 * p;
  const x = mode === 2 ? interpolate(p, [0, 1], [-4, 4]) : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <Img src={staticFile(src)} style={{
        width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translateX(${x}%)`,
      }} />
    </AbsoluteFill>
  );
}

function SceneVisual({ scene, index }) {
  if (scene.kind === 'video') {
    const clipFrames = Math.max(1, scene.clipFrames ?? scene.duration);
    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        <Loop durationInFrames={clipFrames}>
          <OffthreadVideo src={staticFile(scene.src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Loop>
      </AbsoluteFill>
    );
  }
  return <KenBurns src={scene.src} index={index} duration={scene.duration + TRANSITION} />;
}

// Geçişler sahneleri üst üste bindirir; her sahneyi geçiş kadar uzatarak anlatımla senkron kalınır.
function Scenes({ scenes }) {
  const presentations = [fade(), slide({ direction: 'from-right' }), fade(), slide({ direction: 'from-bottom' })];
  return (
    <TransitionSeries>
      {scenes.flatMap((scene, i) => {
        const last = i === scenes.length - 1;
        const items = [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={scene.duration + (last ? 0 : TRANSITION)}>
            <SceneVisual scene={scene} index={i} />
          </TransitionSeries.Sequence>,
        ];
        if (!last) {
          items.push(
            <TransitionSeries.Transition key={`t${i}`} presentation={presentations[i % presentations.length]}
              timing={linearTiming({ durationInFrames: TRANSITION })} />,
          );
        }
        return items;
      })}
    </TransitionSeries>
  );
}

function groupWords(words, { maxWords, maxChars }) {
  const groups = [];
  let cur = [];
  const len = () => cur.reduce((n, w) => n + w.text.length + 1, 0);
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || len() + w.text.length > maxChars)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

const stroke = (px) => ({
  WebkitTextStroke: `${px}px #000`,
  paintOrder: 'stroke fill',
  textShadow: '0 6px 18px rgba(0,0,0,0.65)',
});

// Kelime kelime: aktif kelime renkli ve hafif büyür. Klasik: satır satır beyaz yazı.
function Captions({ words, mode, color, portrait, lang }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  if (mode === 'yok' || !words.length) return null;
  const t = frame / fps;
  const karaoke = mode === 'kelime';
  const groups = groupWords(words, karaoke ? { maxWords: 3, maxChars: 18 } : { maxWords: 9, maxChars: portrait ? 26 : 44 });
  const gi = groups.findIndex((g, i) => t >= g[0].t && (i === groups.length - 1 ? t <= g.at(-1).t + g.at(-1).d + 0.4 : t < groups[i + 1][0].t));
  if (gi < 0) return null;
  const group = groups[gi];
  const enter = spring({ frame: frame - Math.round(group[0].t * fps), fps, config: { damping: 14, stiffness: 180 } });

  const size = karaoke ? (portrait ? 92 : 76) : (portrait ? 60 : 50);
  const bottom = karaoke ? (portrait ? height * 0.3 : 110) : (portrait ? 330 : 60);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: bottom }}>
      <div style={{
        maxWidth: '86%', textAlign: 'center', fontFamily: body, fontSize: size, lineHeight: 1.15, color: '#fff',
        transform: `scale(${0.85 + 0.15 * enter})`, opacity: enter, ...stroke(karaoke ? 10 : 7),
      }}>
        {group.map((w, i) => {
          const active = karaoke && t >= w.t && t < w.t + Math.max(w.d, 0.15);
          const text = karaoke ? w.text.toLocaleUpperCase(lang) : w.text;
          return (
            <span key={i} style={{
              color: active ? color : '#fff',
              display: 'inline-block', margin: '0 0.22em',
              transform: active ? 'scale(1.12)' : 'none',
            }}>{text}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Hook({ text, portrait, color, lang }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text || frame > HOOK_FRAMES) return null;
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const out = interpolate(frame, [HOOK_FRAMES - 10, HOOK_FRAMES], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: portrait ? 'flex-start' : 'center', alignItems: 'center', paddingTop: portrait ? 260 : 0 }}>
      <div style={{
        maxWidth: '84%', padding: '0.25em 0.5em', backgroundColor: color, color: '#000', borderRadius: 18,
        fontFamily: display, fontSize: portrait ? 110 : 120, lineHeight: 1.05, textAlign: 'center',
        transform: `scale(${pop}) rotate(-2deg)`, opacity: out, boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
      }}>
        {text.toLocaleUpperCase(lang)}
      </div>
    </AbsoluteFill>
  );
}

// Karakter rozeti; anlatıcı konuşurken hafifçe nefes alır gibi büyüyüp küçülür.
function Badge({ badge, words, portrait }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (!badge) return null;
  const t = frame / fps;
  const speaking = words.some((w) => t >= w.t && t < w.t + w.d + 0.1);
  const size = portrait ? 300 : 280;
  const bob = speaking ? 1 + 0.035 * Math.sin(frame / 3) : 1;
  const style = portrait
    ? { left: (width - size) / 2, top: 200 }
    : { left: 40, top: height - size - 40 };
  return (
    <Img src={staticFile(badge)} style={{
      position: 'absolute', width: size, height: size, ...style,
      transform: `scale(${bob})`, filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.6))',
    }} />
  );
}

function ProgressBar({ color }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, height: 10, width: `${(frame / durationInFrames) * 100}%`, backgroundColor: color }} />
  );
}

export function VideoComposition(props) {
  const { scenes, words, narration, music, musicVolume, badge, captions, captionColor, hookText, portrait, lang } = props;
  const { durationInFrames } = useVideoConfig();
  const musicVol = (f) => musicVolume * interpolate(f, [0, 60, durationInFrames - 90, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Scenes scenes={scenes} />
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55))' }} />
      <Badge badge={badge} words={words} portrait={portrait} />
      <Captions words={words} mode={captions} color={captionColor} portrait={portrait} lang={lang} />
      <Hook text={hookText} portrait={portrait} color={captionColor} lang={lang} />
      {portrait ? <ProgressBar color={captionColor} /> : null}
      {narration ? <Html5Audio src={staticFile(narration)} /> : null}
      {music ? <Html5Audio src={staticFile(music)} volume={musicVol} loop /> : null}
    </AbsoluteFill>
  );
}
