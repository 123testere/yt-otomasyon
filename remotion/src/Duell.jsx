// "Flaggenduell": ülkeler bir hunide yarışır. Elenenler kenardan fırlayıp aşağıdaki yığına düşer,
// kalanlar huninin dibine doğru kayıp büyür, kazanan boğazdan geçip kupaya oturur.
import { useMemo } from 'react';
import {
  AbsoluteFill, Html5Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { ctaAnlari, ctaMetin } from '../../shared/cta.js';
import { Ball } from './League.jsx';
import { Captions } from './VideoComposition.jsx';
import { body, display } from './fonts.js';

const NAVY = '#0B1230';
const GOLD = '#FFD23F';
const RED = '#FF4D5A';
const WHITE = '#F5F5F0';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const outline = (px) => ({ WebkitTextStroke: `${px}px #000`, paintOrder: 'stroke fill' });
const ease = (t) => 1 - (1 - t) ** 3;

// Huni geometrisi (1080x1920).
const CX = 540;
const TOP_Y = 380;
const NECK_Y = 1130;
const TOP_W = 1000;
const NECK_W = 240;
const SPOUT_Y = 1190;
const widthAt = (y) => NECK_W + (TOP_W - NECK_W) * ((NECK_Y - y) / (NECK_Y - TOP_Y));
const SETTLE = 9; // kalanların yeni yerine kayma süresi (kare)
const FALL = 26; // elenen bayrağın düşüş süresi (kare)
const WINNER_SPOT = { x: CX, y: 1200, s: 170 };

// N bayrağı huninin dibinden yukarı doğru sıralar; sığmazsa küçültür.
function layout(items) {
  const n = items.length;
  if (n === 0) return {};
  if (n === 1) return { [items[0]]: { x: CX, y: NECK_Y - 120, s: 220 } };
  if (n === 2) return { [items[0]]: { x: CX - 190, y: 760, s: 230 }, [items[1]]: { x: CX + 190, y: 760, s: 230 } };
  const area = ((TOP_W + NECK_W) / 2) * (NECK_Y - TOP_Y);
  let s = Math.min(190, Math.sqrt(area / n) * 0.9);
  for (let attempt = 0; attempt < 40; attempt++) {
    const pos = {};
    let i = 0;
    let row = 0;
    let ok = true;
    while (i < n) {
      const y = NECK_Y - s * 0.6 - row * s * 0.92;
      if (y < TOP_Y + s * 0.45) { ok = false; break; }
      const cap = Math.max(1, Math.floor((widthAt(y) - s * 0.15) / (s * 1.02)));
      const take = Math.min(cap, n - i);
      for (let j = 0; j < take; j++) pos[items[i + j]] = { x: CX + (j - (take - 1) / 2) * s * 1.02, y, s };
      i += take;
      row += 1;
    }
    if (ok) return pos;
    s *= 0.94;
  }
  return {};
}

// Elenenlerin dipte biriktiği yığındaki yeri.
function pileSlot(k) {
  const per = 16;
  return { x: 42 + (k % per) * 62.5 + 28, y: 1880 - Math.floor(k / per) * 54 - 28, s: 56 };
}

const lerp = (a, b, t) => a + (b - a) * t;

function useTimeline({ phases, data }) {
  return useMemo(() => {
    const P = Object.fromEntries(phases.map((p) => [p.type, p]));
    const rankedIso = data.ranked.map((c) => c.iso2);
    const initial = [...rankedIso, ...data.noData]; // iyi olanlar dipte, verisi olmayanlar üstte
    const events = [];
    const spread = (list, phase, a, b) => list.forEach((iso2, i) => {
      events.push({ iso2, f: Math.round(phase.from + lerp(a, b, list.length > 1 ? i / (list.length - 1) : 0) * phase.duration) });
    });
    // Önce verisi olmayanlar, sonra en zayıftan başlayarak 3.'ye kadar, finalde 2.
    spread([...data.noData].reverse(), P.nodata, 0.12, 0.7);
    spread(rankedIso.slice(2).reverse(), P.rounds, 0.06, 0.88);
    events.push({ iso2: rankedIso[1], f: P.winner.from + 4 });
    events.sort((a, b) => a.f - b.f);

    const layouts = [layout(initial)];
    let survivors = initial;
    for (const e of events) {
      survivors = survivors.filter((x) => x !== e.iso2);
      layouts.push(layout(survivors));
    }
    const elimIndex = Object.fromEntries(events.map((e, i) => [e.iso2, i]));
    return { P, initial, events, layouts, elimIndex, winner: rankedIso[0] };
  }, [phases, data]);
}

function positionAt(tl, iso2, frame) {
  const { events, layouts, elimIndex, P, winner } = tl;
  // Kazanan: final bitince boğazdan geçip kupaya iner.
  if (iso2 === winner && frame >= P.winner.from + 10) {
    const start = layouts[layouts.length - 1][iso2] ?? WINNER_SPOT;
    const t = interpolate(frame, [P.winner.from + 10, P.winner.from + 34], [0, 1], clamp);
    return { x: lerp(start.x, WINNER_SPOT.x, ease(t)), y: lerp(start.y, WINNER_SPOT.y, t * t), s: lerp(start.s, WINNER_SPOT.s, t), rot: 0, grey: 0 };
  }
  const k = elimIndex[iso2];
  if (k !== undefined && frame >= events[k].f) {
    const from = layouts[k][iso2];
    const to = pileSlot(k);
    const t = interpolate(frame, [events[k].f, events[k].f + FALL], [0, 1], clamp);
    const side = from.x < CX ? -1 : 1;
    // Önce kenardan dışarı ve yukarı fırlar, sonra yerçekimiyle yığına düşer.
    const x = lerp(from.x, to.x, ease(t)) + Math.sin(t * Math.PI) * side * 180;
    const y = from.y + (-520 * t + (to.y - from.y + 520) * t * t);
    return { x, y, s: lerp(from.s, to.s, t), rot: side * t * 540, grey: t };
  }
  // Kalanlar: son elemeden sonra yeni yerlerine kayar.
  let i = 0;
  while (i < events.length && events[i].f <= frame) i++;
  const cur = layouts[i][iso2];
  if (i === 0 || !cur) return { ...(cur ?? layouts[0][iso2]), rot: 0, grey: 0 };
  const prev = layouts[i - 1][iso2] ?? cur;
  const t = ease(interpolate(frame, [events[i - 1].f, events[i - 1].f + SETTLE], [0, 1], clamp));
  return { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), s: lerp(prev.s, cur.s, t), rot: 0, grey: 0 };
}

function Funnel() {
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="glass" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.14)" />
        </linearGradient>
      </defs>
      <path d={`M ${CX - TOP_W / 2} ${TOP_Y} L ${CX + TOP_W / 2} ${TOP_Y} L ${CX + NECK_W / 2} ${NECK_Y} L ${CX + NECK_W / 2} ${SPOUT_Y} L ${CX - NECK_W / 2} ${SPOUT_Y} L ${CX - NECK_W / 2} ${NECK_Y} Z`}
        fill="url(#glass)" stroke={GOLD} strokeWidth={7} strokeLinejoin="round" />
      <ellipse cx={CX} cy={TOP_Y} rx={TOP_W / 2} ry={34} fill="rgba(255,255,255,0.06)" stroke={GOLD} strokeWidth={7} />
    </svg>
  );
}

function Counter({ tl, frame, P }) {
  // Kazanan belli olunca sayaç kaybolur; yerini kazanan ekranı ve tablo alır.
  if (frame >= P.winner.from) return null;
  const alive = tl.initial.length - tl.events.filter((e) => e.f <= frame).length;
  const unitLabel = alive === 1 ? 'LAND' : 'LÄNDER';
  const noDataPhase = frame >= P.nodata.from && frame < P.rounds.from;
  return (
    <div style={{ position: 'absolute', top: TOP_Y - 44, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        background: noDataPhase ? RED : NAVY, border: `5px solid ${GOLD}`, borderRadius: 999, padding: '6px 34px',
        fontFamily: display, fontSize: 52, color: WHITE, boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
      }}>
        {noDataPhase ? `KEINE DATEN · NOCH ${alive}` : `NOCH ${alive} ${unitLabel}`}
      </div>
    </div>
  );
}

const fmt = (n) => Math.round(n).toLocaleString('de-DE');
const pop = (frame, fps, delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 150 } });

function FinalValues({ tl, frame, data }) {
  const { P } = tl;
  if (frame < P.final.from || frame >= P.winner.from + 4) return null;
  const p = interpolate(frame, [P.final.from + 6, P.final.from + P.final.duration - 4], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 4 });
  const [a, b] = data.ranked;
  return (
    <>
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 110, color: GOLD, ...outline(9) }}>FINALE</div>
      <div style={{ position: 'absolute', top: 700, left: 0, right: 0, textAlign: 'center', fontFamily: display, fontSize: 96, color: RED, transform: 'rotate(-8deg)', ...outline(8) }}>VS</div>
      {[[a, CX - 190], [b, CX + 190]].map(([c, x]) => (
        <div key={c.iso2} style={{ position: 'absolute', top: 890, left: x - 220, width: 440, textAlign: 'center' }}>
          <div style={{ fontFamily: display, fontSize: 52, color: WHITE, ...outline(6) }}>{c.name.toLocaleUpperCase('de')}</div>
          <div style={{ fontFamily: display, fontSize: 64, color: GOLD, ...outline(6) }}>{fmt(c.value * p)} t</div>
        </div>
      ))}
    </>
  );
}

function Confetti({ frame }) {
  const colors = [GOLD, RED, '#4C6FFF', '#3DDC97', WHITE];
  return Array.from({ length: 60 }, (_, i) => (
    <div key={i} style={{
      position: 'absolute', left: (i * 157) % 1080, top: ((frame * (6 + (i % 5) * 2)) + i * 53) % 1500 - 100,
      width: 16, height: 28, background: colors[i % 5], transform: `rotate(${frame * 8 + i * 30}deg)`,
    }} />
  ));
}

function WinnerOverlay({ tl, frame, fps, data }) {
  const { P } = tl;
  if (frame < P.winner.from + 20 || frame >= P.why.from) return null;
  const f = frame - P.winner.from - 20;
  const w = data.ranked[0];
  return (
    <>
      <Confetti frame={f} />
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, textAlign: 'center', transform: `scale(${pop(f, fps)})` }}>
        <div style={{ fontFamily: display, fontSize: 130, color: GOLD, ...outline(10) }}>SIEGER</div>
        <div style={{ fontFamily: display, fontSize: 104, color: WHITE, ...outline(9) }}>{w.name.toLocaleUpperCase('de')}</div>
        <div style={{ fontFamily: display, fontSize: 84, color: GOLD, ...outline(8) }}>{fmt(w.value)} TONNEN</div>
      </div>
    </>
  );
}

function WhyOverlay({ tl, frame, fps, data }) {
  const { P } = tl;
  if (frame < P.why.from || frame >= P.table.from) return null;
  const f = frame - P.why.from;
  const points = (data.why ?? []).slice(0, 3);
  return (
    <div style={{ position: 'absolute', top: 440, left: 120, right: 120 }}>
      <div style={{ textAlign: 'center', fontFamily: display, fontSize: 92, color: GOLD, marginBottom: 26, ...outline(8) }}>
        WARUM {data.ranked[0].name.toLocaleUpperCase('de')}?
      </div>
      {points.map((text, i) => {
        const s = pop(f, fps, 6 + i * Math.round((P.why.duration * 0.55) / Math.max(1, points.length)));
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 18, padding: '14px 24px', marginBottom: 16, borderRadius: 18,
            background: 'rgba(11,18,48,0.85)', border: `3px solid ${GOLD}`, opacity: s, transform: `translateY(${(1 - s) * 40}px)`,
          }}>
            <div style={{ fontFamily: display, fontSize: 48, color: GOLD }}>✓</div>
            <div style={{ fontFamily: body, fontSize: 42, color: WHITE }}>{text}</div>
          </div>
        );
      })}
    </div>
  );
}

// Sezon finalinde tablo bölümünün ikinci yarısında sezon şampiyonu açıklanır.
function ChampionOverlay({ frame, fps, data, flags }) {
  const champ = data.table[0];
  const s = pop(frame, fps);
  return (
    <>
      <Confetti frame={frame} />
      <div style={{ position: 'absolute', top: 400, left: 60, right: 60, textAlign: 'center', padding: '30px 20px', borderRadius: 32, background: 'rgba(11,18,48,0.94)', border: `6px solid ${GOLD}`, transform: `scale(${s})` }}>
        <div style={{ fontFamily: display, fontSize: 92, color: GOLD, ...outline(8) }}>SAISONSIEGER {data.season}</div>
        <div style={{ fontSize: 130, marginTop: 6 }}>👑</div>
        <Ball iso2={champ.iso2} flags={flags} size={250} style={{ margin: '0 auto' }} look={Math.sin(frame / 8)} />
        <div style={{ fontFamily: display, fontSize: 90, color: WHITE, marginTop: 16, ...outline(8) }}>{champ.name.toLocaleUpperCase('de')}</div>
        <div style={{ fontFamily: display, fontSize: 64, color: GOLD }}>{champ.points} PUNKTE</div>
      </div>
    </>
  );
}

function TableOverlay({ tl, frame, fps, data, flags, final, eveOfFinal }) {
  const { P } = tl;
  if (frame < P.table.from) return null;
  const f = frame - P.table.from;
  const reveal = Math.round(P.table.duration * 0.45);
  if (final && f >= reveal) return <ChampionOverlay frame={f - reveal} fps={fps} data={data} flags={flags} />;
  return (
    <div style={{ position: 'absolute', top: 400, left: 90, right: 90, padding: 26, borderRadius: 28, background: 'rgba(11,18,48,0.92)', border: `4px solid ${GOLD}` }}>
      <div style={{ textAlign: 'center', fontFamily: display, fontSize: 64, color: GOLD, marginBottom: 14 }}>
        {final ? `ENDSTAND SAISON ${data.season}` : `SAISON ${data.season} · TABELLE`}
      </div>
      {data.table.slice(0, 5).map((r, i) => {
        const s = pop(f, fps, i * 4);
        return (
          <div key={r.iso2} style={{ display: 'flex', alignItems: 'center', gap: 18, height: 96, opacity: s, transform: `translateX(${(1 - s) * 300}px)` }}>
            <div style={{ fontFamily: display, fontSize: 52, width: 44, color: i === 0 ? GOLD : WHITE }}>{i + 1}</div>
            <Ball iso2={r.iso2} flags={flags} size={70} />
            <div style={{ flex: 1, fontFamily: body, fontSize: 40, color: WHITE }}>{r.name}</div>
            <div style={{ fontFamily: display, fontSize: 56, color: GOLD }}>{r.points}</div>
          </div>
        );
      })}
      <div style={{ textAlign: 'center', fontFamily: display, fontSize: 44, color: eveOfFinal ? RED : WHITE, marginTop: 10 }}>
        {eveOfFinal ? 'MORGEN: DAS GROSSE FINALE! 🏆' : 'DEIN THEMA IN DIE KOMMENTARE 👇'}
      </div>
    </div>
  );
}

// Kurz eingeblendeter Like/Abo-Hinweis am Anfang, in der Mitte und am Ende (Benutzerentscheidung 2026-11-27)
function CtaHinweis({ frame, fps, total }) {
  const t = frame / fps; const d = total / fps;
  const [like, abo] = ctaMetin('de').cagri;
  return ctaAnlari(d).map((t0, i) => {
    const a = Math.min(1, Math.max(0, (t - t0) / 0.3)) * (1 - Math.min(1, Math.max(0, (t - t0 - 2.3) / 0.3)));
    if (a <= 0) return null;
    const z = 1 + 0.15 * Math.max(0, 1 - (t - t0) / 0.35);
    return <div key={i} style={{ position: 'absolute', top: 470, right: 60, opacity: a, transform: `scale(${z})`, transformOrigin: 'right center', background: '#C0392B', color: WHITE, fontFamily: display, fontSize: 40, padding: '14px 30px', borderRadius: 44, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>{like} · {abo}</div>;
  });
}

export function Duell(props) {
  const { phases, data, flags, words, narration, music, musicVolume, brand, match, season = 1, total = 30, seasonFinal = false, eveOfFinal = false } = props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tl = useTimeline({ phases, data });
  const { P } = tl;
  const musicVol = (f) => musicVolume * interpolate(f, [0, 30, durationInFrames - 60, durationInFrames], [0, 1, 1, 0], clamp);
  const order = [...tl.initial].sort((a, b) => (tl.elimIndex[a] ?? 999) - (tl.elimIndex[b] ?? 999));
  const q = data.question.toLocaleUpperCase('de').split(' ');
  const trophy = frame >= P.winner.from;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 20%, #22348A 0%, ${NAVY} 62%, #050816 100%)` }}>
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: seasonFinal ? RED : GOLD, color: seasonFinal ? WHITE : NAVY, fontFamily: display, fontSize: 46, padding: '6px 28px', borderRadius: 12, letterSpacing: 2 }}>
          {seasonFinal ? `SAISONFINALE · DUELL ${match}/${total}` : `${brand} · SAISON ${season} · DUELL ${match}/${total}`}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 150, left: 50, right: 50, textAlign: 'center', fontFamily: display, fontSize: 70, lineHeight: 1.02, ...outline(7) }}>
        {q.map((w, i) => {
          const s = pop(frame, fps, i * 3);
          return <span key={i} style={{ display: 'inline-block', margin: '0 0.14em', color: i >= q.length - 2 ? GOLD : WHITE, opacity: s }}>{w}</span>;
        })}
        <span style={{ marginLeft: 12 }}>{data.emoji}</span>
      </div>
      <Funnel />
      {trophy ? <div style={{ position: 'absolute', top: WINNER_SPOT.y + 60, left: 0, right: 0, textAlign: 'center', fontSize: 120, transform: `scale(${pop(frame, fps, P.winner.from + 20)})` }}>🏆</div> : null}
      {/* Önce elenecekler önce çizilir; düşerken kalanların üstünden geçmesinler diye yığındakiler en altta. */}
      {order.map((iso2) => {
        const p = positionAt(tl, iso2, frame);
        if (!p || p.x === undefined) return null;
        return (
          <div key={iso2} style={{ position: 'absolute', left: p.x - p.s / 2, top: p.y - p.s / 2, transform: `rotate(${p.rot}deg)` }}>
            <Ball iso2={iso2} flags={flags} size={p.s} grey={p.grey} look={Math.sin(frame / 14 + p.x / 90)} />
          </div>
        );
      })}
      <Counter tl={tl} frame={frame} P={P} />
      <FinalValues tl={tl} frame={frame} data={data} />
      <WinnerOverlay tl={tl} frame={frame} fps={fps} data={data} />
      <WhyOverlay tl={tl} frame={frame} fps={fps} data={data} />
      <TableOverlay tl={tl} frame={frame} fps={fps} data={data} flags={flags} final={seasonFinal} eveOfFinal={eveOfFinal} />
      <CtaHinweis frame={frame} fps={fps} total={durationInFrames} />
      <Captions words={words} mode="kelime" color={GOLD} portrait lang="de" bottomOverride={400} />
      {narration ? <Html5Audio src={staticFile(narration)} /> : null}
      {music ? <Html5Audio src={staticFile(music)} volume={musicVol} loop /> : null}
    </AbsoluteFill>
  );
}
