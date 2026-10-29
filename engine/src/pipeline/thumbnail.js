import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../lib/util.js';

const FONT = process.env.FONT_BOLD ?? '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf';
const W = 1280;
const H = 720;

function wrap(text, maxChars = 14, maxLines = 3) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines).join('\n');
}

// Arka plan görseli + sol tarafta büyük başlık + (varsa) sağda karakter rozeti.
export async function makeThumbnail({ background, text, locale, badge, dir }) {
  const textFile = path.join(dir, 'kapak.txt');
  await fs.writeFile(textFile, wrap(text.toLocaleUpperCase(locale)));
  const out = path.join(dir, 'kapak.jpg');
  const textX = 50;
  let filter = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},`
    + `drawbox=x=0:y=0:w=${Math.round(W * 0.64)}:h=${H}:color=black@0.45:t=fill,`
    + `drawtext=fontfile=${FONT}:textfile=${path.basename(textFile)}:fontsize=92:fontcolor=0xFFE600:`
    + `borderw=7:bordercolor=black:line_spacing=12:x=${textX}:y=(h-text_h)/2[bg]`;
  const args = ['-y', '-v', 'error', '-i', background];
  if (badge) {
    args.push('-i', badge);
    filter += `;[1:v]scale=420:420[b];[bg][b]overlay=${W - 460}:${(H - 420) / 2}[out]`;
  } else {
    filter += ';[bg]null[out]';
  }
  args.push('-filter_complex', filter, '-map', '[out]', '-frames:v', '1', '-q:v', '3', out);
  await run('ffmpeg', args, { cwd: dir });
  return out;
}
