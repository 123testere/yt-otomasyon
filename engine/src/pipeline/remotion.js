// Remotion ile animasyonlu video ve kapak görseli üretir. Dosyalar remotion/public/<iş>/ altına
// kopyalanır (Remotion yalnızca public klasöründen okur), render sonrası silinir.
import fs from 'node:fs';
import path from 'node:path';
import { options, pick } from '../lib/options.js';
import { ROOT } from '../lib/paths.js';
import { probeDuration, run } from '../lib/util.js';
import { alignWords } from './subtitles.js';
import { sfxHazirla } from '../lib/sfx.js';
import { v4Kanal } from '../lib/master-v4.js';

// Master v4 (U3): uzun video kapağı 3840×2160. Yol/kimlik içinde v4 kanal kimliği geçiyorsa kapak yüksek çözünürlükte çizilir.
const KANAL_RE = /UC[w-]{22}/;
export const v4Yol = (...parcalar) => v4Kanal(parcalar.join(' ').match(KANAL_RE)?.[0]);
const KAPAK_OLCEK = { Thumb: 3, AnsiklopediThumb: 3, DiziKareYatay: 2 };

// Kapak PNG → JPEG. v4'te 3840×2160 ve YouTube'un 2 MB sınırına sığana kadar kalite düşürülür.
export async function kapakJpeg(png, jpg, { v4 = v4Yol(png), olcek = null } = {}) {
  if (!v4) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', png, ...(olcek ? ['-vf', olcek] : []), '-q:v', '3', jpg]);
    return jpg;
  }
  for (const q of [2, 3, 4, 6, 8, 11, 15]) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-vf', 'scale=3840:2160:flags=lanczos', '-q:v', String(q), jpg]);
    if (fs.statSync(jpg).size < 1.95 * 1024 * 1024) return jpg;
  }
  return jpg;
}

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
  const olcek = args[0] === 'still' && KAPAK_OLCEK[args[2]] && v4Yol(...args) ? [`--scale=${KAPAK_OLCEK[args[2]]}`] : [];
  await run(process.execPath, [cli, ...args, ...olcek, '--log=error'], { cwd: DIR });
}

const accentOf = (settings) => (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;

export async function renderWithRemotion({ job, settings, fmt, narrated, shots, badge, music, dir }) {
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
    await kapakJpeg(png, jpg);
    return jpg;
  } finally {
    stage.cleanup();
  }
}

// Çizim formatı (Lamba Altında): sahneler senaryodaki `cizim` kodundan çizilir (remotion/src/Encyclopedia.jsx).
export async function renderEncyclopedia({ job, settings, fmt, narrated, images, music, dir }) {
  sfxHazirla(path.join(DIR, 'public', 'sfx'));
  const stage = stager(job.id);
  try {
    const words = narrated.scenes.flatMap((s, i) => alignWords(job.scenes[i].narration, s.words))
      .map(({ t, d, text }) => ({ t, d, text }));
    const props = {
      fps: FPS, width: fmt.w, height: fmt.h, portrait: fmt.portrait, lang: settings.language,
      durationInFrames: Math.max(1, Math.round(narrated.total * FPS)),
      scenes: job.scenes.map((s, i) => ({
        t0: narrated.scenes[i].start, cizim: s.cizim ?? null, ifade: s.ifade ?? null, bolum: s.bolum ?? null,
        img: stage.add(images[i]?.file),
      })),
      words,
      narration: stage.add(narrated.narration),
      music: stage.add(music?.file),
      musicVolume: Number(settings.musicVolume),
      baslik: job.baslikKart ?? null,
      kapanis: job.kapanis ?? null,
      rozet: job.rozet ?? null,
    };
    const propsFile = path.join(dir, 'remotion-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const out = path.join(dir, 'video.mp4');
    await remotion(['render', ENTRY, 'Ansiklopedi', out, `--props=${propsFile}`, '--codec=h264', '--crf=20']);
    return out;
  } finally {
    stage.cleanup();
  }
}

export async function encyclopediaThumbnail({ job, settings, dir }) {
  const props = { text: job.thumbnailText, sub: job.kapakAlt ?? null, cizim: job.kapakCizim ?? null, lang: settings.language };
  const propsFile = path.join(dir, 'kapak-props.json');
  fs.writeFileSync(propsFile, JSON.stringify(props));
  const png = path.join(dir, 'kapak.png');
  await remotion(['still', ENTRY, 'AnsiklopediThumb', png, `--props=${propsFile}`]);
  const jpg = path.join(dir, 'kapak.jpg');
  await kapakJpeg(png, jpg, { v4: v4Kanal(job.channelId) });
  return jpg;
}

// Tek kare (küçük resim): görsel dosyası public/ altına kopyalanır, props'taki `background` onu gösterir.
export async function remotionStill(id, props, png, jobId) {
  const stage = stager(jobId);
  try {
    const propsFile = `${png}.props.json`;
    fs.writeFileSync(propsFile, JSON.stringify({ ...props, background: stage.add(props.background) }));
    await remotion(['still', ENTRY, id, png, `--props=${propsFile}`]);
    return png;
  } finally {
    stage.cleanup();
  }
}

// Animasyonlu dizi bölümü (remotion/src/Dizi.jsx): mekân ve karakterler kodla çizilir.
export async function renderDizi({ job, dir, ses, music, muzikler = null, musicVolume, boyut = { width: 1080, height: 1920 }, props: extra }) {
  // Efekt sesleri (kodla üretilir, bir kez): remotion/public/sfx
  sfxHazirla(path.join(DIR, 'public', 'sfx'));
  const stage = stager(job.id);
  try {
    const props = {
      fps: FPS, ...boyut, durationInFrames: Math.max(1, Math.round(ses.total * FPS)),
      scenes: ses.scenes, words: ses.words,
      narration: stage.add(ses.narration), music: stage.add(music?.file), musicVolume,
      // Sahneye göre müzik bölümleri: [{ src, t0, t1 }]
      muzikler: muzikler?.length ? muzikler.map((m) => ({ src: stage.add(m.file), t0: m.t0, t1: m.t1 })) : null,
      ...extra,
    };
    const propsFile = path.join(dir, 'remotion-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const out = path.join(dir, 'video.mp4');
    await remotion(['render', ENTRY, 'Dizi', out, `--props=${propsFile}`, '--codec=h264', '--crf=20']);
    return out;
  } finally {
    stage.cleanup();
  }
}

// Yayın kesiti (Vice City Dispatch): remotion/src/Kesit.jsx
export async function renderKesit({ job, dir, video, sure, yorumlar, altyazi = [], kamera = null, settings }) {
  const stage = stager(job.id);
  try {
    const props = {
      fps: FPS, width: 1080, height: 1920, durationInFrames: Math.max(1, Math.round(sure * FPS)),
      video: stage.add(video),
      hook: job.hook ?? null,
      kredi: job.kredi ?? `${job.kaynak.yayinci} · ${job.kaynak.platform}`,
      yorumlar: yorumlar.map((y) => ({ t0: y.t0, d: y.d, kapanis: y.kapanis, ses: stage.add(y.wav), words: y.words.map(({ t, d, text }) => ({ t, d, text })) })),
      altyazi, // yayıncının konuşması (yorum yoksa)
      kamera, // yayıncı kamerası (kaynak karesinde 0-1 kutu) ya da null
      cta: job.cta ?? (settings.language === "tr" ? "DEVAMI İÇİN ABONE OL" : "FOLLOW FOR MORE"),
      kisma: Number(job.kisma ?? 0.22), // yorum sırasında yayın sesi
      accent: job.accent ?? '#FF2E88',
      lang: settings.language ?? 'en',
    };
    const propsFile = path.join(dir, 'remotion-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const out = path.join(dir, 'video.mp4');
    await remotion(['render', ENTRY, 'Kesit', out, `--props=${propsFile}`, '--codec=h264', '--crf=20']);
    return out;
  } finally {
    stage.cleanup();
  }
}
