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

// CLI doğrudan Node ile çalıştırılır (npx Windows'ta .cmd olduğu için spawn edilemiyor).
async function remotion(args) {
  const cli = path.join(DIR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  await run(process.execPath, [cli, ...args, '--log=error'], { cwd: DIR });
}

const accentOf = (settings) => (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;

export async function renderWithRemotion({ job, settings, fmt, narrated, shots, badge, music, dir, theme = null }) {
  const stage = stager(job.id);
  try {
    // Çekim sınırlarını kümülatif saniyeden kareye çevir; yuvarlama hatası birikmesin.
    const scenes = [];
    for (const shot of shots) {
      const from = Math.round(shot.start * FPS);
      const to = Math.round((shot.start + shot.duration) * FPS);
      const v = shot.visual;
      scenes.push(v.motionBg ? { kind: 'none', duration: Math.max(1, to - from) } : {
        kind: v.kind,
        src: stage.add(v.file),
        duration: Math.max(1, to - from),
        clipFrames: v.kind === 'video' ? Math.max(1, Math.round((await probeDuration(v.file)) * FPS)) : undefined,
      });
    }
    // Claude'un sahneye yazdığı hareketli grafik, sahnenin anlatım süresi boyunca ekranda kalır.
    const motions = job.scenes.flatMap((scene, i) => {
      if (!scene.visual?.motion) return [];
      const s = narrated.scenes[i];
      const from = Math.round(s.start * FPS);
      return [{ from, duration: Math.max(1, Math.round((s.start + s.duration) * FPS) - from), motion: scene.visual.motion }];
    });
    const words = narrated.scenes.flatMap((s, i) => alignWords(job.scenes[i].narration, s.words))
      .map(({ t, d, text }) => ({ t, d, text }));

    const props = {
      fps: FPS, width: fmt.w, height: fmt.h, portrait: fmt.portrait, lang: settings.language,
      durationInFrames: Math.max(1, Math.round(narrated.total * FPS)),
      scenes, motions, words,
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
    // Ansiklopedi teması kendi kompozisyonunda (remotion/src/Encyclopedia.jsx).
    await remotion(['render', ENTRY, theme === 'ansiklopedi' ? 'Ansiklopedi' : 'Video', out, `--props=${propsFile}`, '--codec=h264', '--crf=20']);
    return out;
  } finally {
    stage.cleanup();
  }
}

export async function thumbnailWithRemotion({ jobId, background, text, badge, settings, dir, theme = null }) {
  const stage = stager(`${jobId}-kapak`);
  try {
    const props = { background: stage.add(background), badge: stage.add(badge), text, lang: settings.language, accent: accentOf(settings), theme };
    const propsFile = path.join(dir, 'kapak-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const png = path.join(dir, 'kapak.png');
    await remotion(['still', ENTRY, theme === 'ansiklopedi' ? 'AnsiklopediThumb' : 'Thumb', png, `--props=${propsFile}`]);
    // YouTube küçük resim sınırı 2 MB; JPEG'e çevir.
    const jpg = path.join(dir, 'kapak.jpg');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', jpg]);
    return jpg;
  } finally {
    stage.cleanup();
  }
}
