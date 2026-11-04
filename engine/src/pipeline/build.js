import fs from 'node:fs';
import path from 'node:path';
import { ensurePortrait } from '../lib/character.js';
import { options, pick } from '../lib/options.js';
import { narrate } from './tts.js';
import { aiImage, sceneVisual, seedFor } from './visuals.js';
import { writeSubtitles } from './subtitles.js';
import { characterPlacement, formatFor, makeCharacterBadge, pickMusic, renderFinal, renderSceneClip } from './render.js';
import { makeThumbnail } from './thumbnail.js';
import { remotionAvailable, renderWithRemotion, thumbnailWithRemotion } from './remotion.js';
import { buildDuell } from '../league/build-duell.js';
import { buildCizim } from './build-cizim.js';

async function characterImage(channelId, settings, cacheDir) {
  try {
    return await ensurePortrait(channelId, settings, cacheDir);
  } catch (e) {
    console.warn(`  karakter görseli alınamadı: ${e.message}`);
    return null;
  }
}

// İzleyici ilgisi için görüntü sık değişmeli: Shorts'ta ~3,5 sn, uzun videoda ~6 sn'de bir yeni çekim.
// Aynı sahnenin çekimleri farklı kamera açılarıyla istenir ki tekrar gibi görünmesin.
const SHOT_SEC = { short: 3.5, long: 6 };
const MAX_SHOTS_PER_SCENE = 4;
const ANGLES = ['', ', close-up detail shot', ', wide establishing shot', ', dramatic low angle shot'];

async function planShots(job, narrated, fmt, { settings, dir, used, seedBase }) {
  const shots = [];
  for (const [i, scene] of job.scenes.entries()) {
    const { start, duration } = narrated.scenes[i];
    const count = Math.min(MAX_SHOTS_PER_SCENE, Math.max(1, Math.round(duration / SHOT_SEC[job.type])));
    for (let j = 0; j < count; j++) {
      const variant = { ...scene, visual: { ...scene.visual, prompt: `${scene.visual.prompt}${ANGLES[j]}` } };
      const visual = await sceneVisual(variant, shots.length, {
        settings, fmt, dir, used, seedBase, previous: shots.map((s) => s.visual),
      });
      shots.push({ visual, start: start + (duration * j) / count, duration: duration / count });
    }
  }
  return shots;
}

export async function buildVideo(job, settings, { workDir, cacheDir }) {
  if (job.format === 'duell') return buildDuell(job, settings, { workDir });
  if (job.format === 'cizim') return buildCizim(job, settings, { workDir });
  const fmt = formatFor(job.type);
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });

  console.log('  seslendirme…');
  const narrated = await narrate(job, settings, dir);

  console.log('  görseller…');
  const used = new Set();
  const seedBase = seedFor(job.id);
  const shots = await planShots(job, narrated, fmt, { settings, dir, used, seedBase });
  const visuals = shots.map((s) => s.visual);
  console.log(`  ${job.scenes.length} sahne, ${shots.length} çekim`);

  const charSrc = await characterImage(job.channelId, settings, cacheDir);
  const placement = characterPlacement(fmt);
  const badge = charSrc && settings.characterOnScreen
    ? await makeCharacterBadge(charSrc, placement.size, path.join(dir, 'rozet.png'))
    : null;
  const music = await pickMusic(settings.music, dir);

  let videoPath = null;
  if (settings.template === 'animasyonlu' && remotionAvailable()) {
    console.log('  animasyonlu render (Remotion)…');
    try {
      videoPath = await renderWithRemotion({ job, settings, fmt, narrated, shots, badge, music, dir });
    } catch (e) {
      console.warn(`  Remotion render başarısız, klasik yönteme geçiliyor: ${e.message}`);
    }
  }

  if (!videoPath) {
    console.log('  sahneler render ediliyor…');
    const clips = [];
    for (const [i, shot] of shots.entries()) {
      clips.push(await renderSceneClip(shot.visual, i, shot.duration, fmt, dir));
    }
    const subtitles = await writeSubtitles({
      jobScenes: job.scenes, narrated, settings, fmt,
      sideMargin: badge && !fmt.portrait ? placement.sideMargin : 60,
      file: path.join(dir, 'altyazi.ass'),
    });
    console.log('  son kurgu…');
    videoPath = await renderFinal({
      clips, narration: narrated.narration, total: narrated.total, subtitles, badge, placement,
      music: music?.file, musicVolume: settings.musicVolume, dir,
    });
  }

  let thumbnailPath = null;
  if (job.type === 'long') {
    console.log('  küçük resim…');
    const style = pick(options.visualStyles, settings.visualStyle);
    let background = visuals.find((v) => v.kind === 'image')?.file;
    try {
      background = await aiImage(`${job.thumbnailPrompt}, ${style?.suffix ?? 'cinematic'}, eye-catching youtube thumbnail`,
        { w: 1280, h: 720, seed: seedBase + 999 }, path.join(dir, 'kapak-arka.jpg'));
    } catch (e) {
      console.warn(`  kapak görseli üretilemedi, sahne görseli kullanılacak: ${e.message}`);
    }
    if (background) {
      const thumbBadge = charSrc ? await makeCharacterBadge(charSrc, 440, path.join(dir, 'kapak-rozet.png')) : null;
      if (remotionAvailable()) {
        try {
          thumbnailPath = await thumbnailWithRemotion({ jobId: job.id, background, text: job.thumbnailText, badge: thumbBadge, settings, dir });
        } catch (e) {
          console.warn(`  Remotion kapak başarısız, klasik kapak üretiliyor: ${e.message}`);
        }
      }
      thumbnailPath ??= await makeThumbnail({ background, text: job.thumbnailText, locale: settings.language, badge: thumbBadge, dir });
    }
  }

  const credits = [...new Set([music?.credit, ...visuals.map((v) => v.credit)].filter(Boolean))];
  return { videoPath, thumbnailPath, duration: narrated.total, credits };
}
