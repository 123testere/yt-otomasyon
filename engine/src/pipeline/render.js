import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { MUSIC_DIR, ROOT } from '../lib/paths.js';
import { download, run } from '../lib/util.js';

const FPS = 30;
const ENCODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(FPS)];

export const formatFor = (type) =>
  type === 'short' ? { w: 1080, h: 1920, portrait: true } : { w: 1920, h: 1080, portrait: false };

// Fotoğrafa yavaş yakınlaşma/uzaklaşma/kaydırma (Ken Burns) uygular; sahneden sahneye hareket değişir.
function kenBurns(i, frames, { w, h }) {
  const step = (0.15 / frames).toFixed(6);
  const center = `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
  const motion = [
    `z='min(1+${step}*on,1.15)':${center}`,
    `z='max(1.15-${step}*on,1)':${center}`,
    `z='1.12':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)'`,
  ][i % 3];
  return `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},`
    + `zoompan=${motion}:d=${frames}:s=${w}x${h}:fps=${FPS},format=yuv420p`;
}

export async function renderSceneClip(visual, i, duration, fmt, dir) {
  const out = path.join(dir, `klip-${String(i).padStart(3, '0')}.mp4`);
  const frames = Math.max(1, Math.round(duration * FPS));
  if (visual.kind === 'video') {
    await run('ffmpeg', ['-y', '-v', 'error', '-stream_loop', '-1', '-i', visual.file, '-t', duration.toFixed(3), '-an',
      '-vf', `scale=${fmt.w}:${fmt.h}:force_original_aspect_ratio=increase,crop=${fmt.w}:${fmt.h},fps=${FPS},format=yuv420p`,
      ...ENCODE, out]);
  } else {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', visual.file, '-vf', kenBurns(i, frames, fmt),
      '-frames:v', String(frames), ...ENCODE, out]);
  }
  return out;
}

// Yuvarlak, beyaz çerçeveli karakter rozeti.
export async function makeCharacterBadge(src, size, dest) {
  const c = size / 2;
  const r = `hypot(X-${c},Y-${c})`;
  const ring = (ch) => `if(gt(${r},${c - 7}),255,${ch}(X,Y))`;
  await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf',
    `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size},format=rgba,`
    + `geq=r='${ring('r')}':g='${ring('g')}':b='${ring('b')}':a='if(lte(${r},${c}),255,0)'`,
    '-frames:v', '1', dest]);
  return dest;
}

export function characterPlacement(fmt) {
  return fmt.portrait
    ? { size: 300, x: (fmt.w - 300) / 2, y: 200, sideMargin: 60 }
    : { size: 280, x: 40, y: fmt.h - 280 - 40, sideMargin: 280 + 80 };
}

const musicLibrary = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'music.json'), 'utf8'));
const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

// Önce kullanıcının assets/music/<tür>/ klasörüne koyduğu parçalar; yoksa telifsiz kütüphaneden indirilir.
export async function pickMusic(mood, dir) {
  if (!mood || mood === 'yok') return null;
  const own = path.join(MUSIC_DIR, mood);
  const tracks = fs.existsSync(own) ? fs.readdirSync(own).filter((f) => /\.(mp3|m4a|wav|ogg)$/i.test(f)) : [];
  if (tracks.length) return { file: path.join(own, randomOf(tracks)), credit: null };

  const titles = musicLibrary.moods[mood];
  if (!titles?.length) return null;
  const title = randomOf(titles);
  const file = path.join(dir, 'muzik.mp3');
  try {
    await download(`${musicLibrary.source}${encodeURIComponent(title)}.mp3`, file, { timeoutMs: 120_000, minBytes: 100_000 });
  } catch (e) {
    console.warn(`  müzik indirilemedi (${title}): ${e.message}; müziksiz devam ediliyor.`);
    return null;
  }
  return { file, credit: `"${title}" ${musicLibrary.artist}, ${musicLibrary.license}` };
}

export async function renderFinal({ clips, narration, total, subtitles, badge, placement, music, musicVolume, dir }) {
  const list = path.join(dir, 'klip-liste.txt');
  await fsp.writeFile(list, clips.map((c) => `file '${path.basename(c)}'`).join('\n'));

  const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', narration];
  let next = 2;
  const musicIdx = music ? next++ : null;
  if (music) args.push('-stream_loop', '-1', '-i', music);
  const badgeIdx = badge ? next++ : null;
  if (badge) args.push('-i', badge);

  const filters = [];
  let v = '[0:v]';
  if (subtitles) {
    filters.push(`${v}subtitles=${path.basename(subtitles)}[vs]`);
    v = '[vs]';
  }
  if (badge) {
    filters.push(`${v}[${badgeIdx}:v]overlay=${placement.x}:${placement.y}[vc]`);
    v = '[vc]';
  }
  let a = '1:a';
  if (music) {
    const fadeOut = Math.max(0, total - 3).toFixed(2);
    filters.push(`[${musicIdx}:a]volume=${musicVolume},afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3[m]`,
      '[1:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]');
    a = '[a]';
  }
  if (filters.length) args.push('-filter_complex', filters.join(';'));

  const out = path.join(dir, 'video.mp4');
  args.push('-map', v === '[0:v]' ? '0:v' : v, '-map', a,
    ...(v === '[0:v]' ? ['-c:v', 'copy'] : ENCODE),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', total.toFixed(3), '-movflags', '+faststart', out);
  await run('ffmpeg', args, { cwd: dir });
  return out;
}
