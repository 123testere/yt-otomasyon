import fs from 'node:fs/promises';
import { options, pick } from '../lib/options.js';

const norm = (s) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// edge-tts kelimeleri noktalama içermez; metindeki orijinal kelimelerle eşleştirip noktalamayı geri kazanır.
function alignWords(narration, words) {
  const tokens = narration.trim().split(/\s+/);
  let j = 0;
  return words.map((w) => {
    const target = norm(w.w);
    for (let k = j; k < Math.min(tokens.length, j + 4); k++) {
      if (target && norm(tokens[k]).includes(target)) {
        j = k + 1;
        return { ...w, text: tokens[k] };
      }
    }
    return { ...w, text: w.w };
  });
}

function group(words, { maxChars, maxWords }) {
  const groups = [];
  let cur = [];
  const len = () => cur.reduce((n, w) => n + w.text.length + 1, 0);
  for (const w of words) {
    if (cur.length && (len() + w.text.length > maxChars || cur.length >= maxWords)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?…;:]$/.test(w.text) && len() > maxChars / 3) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

const ts = (sec) => {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

const escapeAss = (t) => t.replace(/\\/g, '\\\\').replace(/[{}]/g, '').replace(/\n/g, ' ');

export async function writeSubtitles({ jobScenes, narrated, settings, fmt, sideMargin, file }) {
  const mode = settings.subtitles;
  if (mode === 'yok') return null;
  const color = pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[0];
  const short = fmt.portrait;
  const style = mode === 'kelime'
    ? { size: short ? 104 : 84, outline: 6, marginV: short ? 700 : 120, maxChars: 18, maxWords: 3, upper: true }
    : { size: short ? 64 : 54, outline: 3, marginV: short ? 380 : 60, maxChars: short ? 26 : 42, maxWords: 12, upper: false };

  const words = narrated.scenes.flatMap((s, i) => alignWords(jobScenes[i].narration, s.words));
  const groups = group(words, style);
  const locale = settings.language;

  const lines = groups.map((g, i) => {
    const start = g[0].t;
    const naturalEnd = g.at(-1).t + g.at(-1).d + 0.25;
    const end = i + 1 < groups.length ? Math.min(naturalEnd, groups[i + 1][0].t) : naturalEnd;
    let text = g.map((w) => w.text).join(' ');
    if (style.upper) text = text.toLocaleUpperCase(locale);
    return `Dialogue: 0,${ts(start)},${ts(Math.max(end, start + 0.3))},Main,,0,0,0,,${escapeAss(text)}`;
  });

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${fmt.w}
PlayResY: ${fmt.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Noto Sans,${style.size},${color.primary},&H000000FF,${color.outline},&H80000000,-1,0,0,0,100,100,0,0,1,${style.outline},2,2,${sideMargin},${sideMargin},${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
  await fs.writeFile(file, ass);
  return file;
}
