// Remotion ile animasyonlu video ve kapak görseli üretir. Dosyalar remotion/public/<iş>/ altına
// kopyalanır (Remotion yalnızca public klasöründen okur), render sonrası silinir.
import fs from 'node:fs';
import path from 'node:path';
import { options, pick } from '../lib/options.js';
import { ROOT } from '../lib/paths.js';
import { probeDuration, run } from '../lib/util.js';
import { alignWords } from './subtitles.js';

const DIR = path.join(ROOT, 'remotion');
const ENTRY = 'src/index.jsx';
const FPS = 30;

export const remotionAvailable = () => fs.existsSync(path.join(DIR, 'node_modules', 'remotion'));

function stager(jobId) {
  const folder = path.join(DIR, 'public', jobId);
  fs.mkdirSync(folder, { recursive: true });
  let n = 0;
  return {
    add(file) {
      if (!file) return null;
      const name = `${String(n++).padStart(3, '0')}${path.extname(file)}`;
      fs.copyFileSync(file, path.join(folder, name));
      return `${jobId}/${name}`;
    },
    cleanup: () => fs.rmSync(folder, { recursive: true, force: true }),
  };
}

async function remotion(args) {
  await run('npx', ['remotion', ...args, '--log=error'], { cwd: DIR });
}

const accentOf = (settings) => (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;

export async function renderWithRemotion({ job, settings, fmt, narrated, visuals, badge, music, dir }) {
  const stage = stager(job.id);
  try {
    // Sahne sınırlarını kümülatif saniyeden kareye çevir; yuvarlama hatası birikmesin.
    const scenes = [];
    for (const [i, s] of narrated.scenes.entries()) {
      const from = Math.round(s.start * FPS);
      const to = Math.round((s.start + s.duration) * FPS);
      const v = visuals[i];
      scenes.push({
        kind: v.kind,
        src: stage.add(v.file),
        duration: Math.max(1, to - from),
        clipFrames: v.kind === 'video' ? Math.max(1, Math.round((await probeDuration(v.file)) * FPS)) : undefined,
      });
    }
    const words = narrated.scenes.flatMap((s, i) => alignWords(job.scenes[i].narration, s.words))
      .map(({ t, d, text }) => ({ t, d, text }));

    const props = {
      fps: FPS, width: fmt.w, height: fmt.h, portrait: fmt.portrait, lang: settings.language,
      durationInFrames: Math.max(1, Math.round(narrated.total * FPS)),
      scenes, words,
      narration: stage.add(narrated.narration),
      music: stage.add(music?.file),
      musicVolume: Number(settings.musicVolume),
      badge: stage.add(badge),
      captions: settings.subtitles,
      captionColor: accentOf(settings),
      hookText: job.hookText?.trim() || null,
    };
    const propsFile = path.join(dir, 'remotion-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const out = path.join(dir, 'video.mp4');
    await remotion(['render', ENTRY, 'Video', out, `--props=${propsFile}`, '--codec=h264', '--crf=20']);
    return out;
  } finally {
    stage.cleanup();
  }
}

export async function thumbnailWithRemotion({ jobId, background, text, badge, settings, dir }) {
  const stage = stager(`${jobId}-kapak`);
  try {
    const props = { background: stage.add(background), badge: stage.add(badge), text, lang: settings.language, accent: accentOf(settings) };
    const propsFile = path.join(dir, 'kapak-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const png = path.join(dir, 'kapak.png');
    await remotion(['still', ENTRY, 'Thumb', png, `--props=${propsFile}`]);
    // YouTube küçük resim sınırı 2 MB; JPEG'e çevir.
    const jpg = path.join(dir, 'kapak.jpg');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', jpg]);
    return jpg;
  } finally {
    stage.cleanup();
  }
}
