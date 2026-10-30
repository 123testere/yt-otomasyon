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

async function characterImage(channelId, settings, cacheDir) {
  try {
    return await ensurePortrait(channelId, settings, cacheDir);
  } catch (e) {
    console.warn(`  karakter görseli alınamadı: ${e.message}`);
    return null;
  }
}

export async function buildVideo(job, settings, { workDir, cacheDir }) {
  const fmt = formatFor(job.type);
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });

  console.log('  seslendirme…');
  const narrated = await narrate(job, settings, dir);

  console.log('  görseller…');
  const used = new Set();
  const seedBase = seedFor(job.id);
  const visuals = [];
  for (const [i, scene] of job.scenes.entries()) {
    visuals.push(await sceneVisual(scene, i, { settings, fmt, dir, used, seedBase, previous: visuals }));
  }

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
      videoPath = await renderWithRemotion({ job, settings, fmt, narrated, visuals, badge, music, dir });
    } catch (e) {
      console.warn(`  Remotion render başarısız, klasik yönteme geçiliyor: ${e.message}`);
    }
  }

  if (!videoPath) {
    console.log('  sahneler render ediliyor…');
    const clips = [];
    for (const [i, visual] of visuals.entries()) {
      clips.push(await renderSceneClip(visual, i, narrated.scenes[i].duration, fmt, dir));
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
