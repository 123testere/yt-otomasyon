// Çizim formatı (Lamba Altında): her sahne senaryodaki `cizim` koduyla mürekkeple çizilir, Nur Bey anlatır.
// Sahnede `cizim` yerine `visual` varsa (ara sıra) arşivden görsel bulunur ve levha olarak gösterilir.
import fs from 'node:fs';
import path from 'node:path';
import { narrate } from './tts.js';
import { sceneVisual, seedFor } from './visuals.js';
import { formatFor, pickMusic } from './render.js';
import { encyclopediaThumbnail, renderEncyclopedia } from './remotion.js';

export async function buildCizim(job, settings, { workDir }) {
  const fmt = formatFor(job.type);
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });

  console.log('  seslendirme…');
  const narrated = await narrate(job, settings, dir);

  const images = [];
  const used = new Set();
  const seedBase = seedFor(job.id);
  for (const [i, scene] of job.scenes.entries()) {
    const visual = !scene.cizim && scene.visual?.query
      ? await sceneVisual(scene, i, { settings, fmt, dir, used, seedBase })
      : null;
    images.push(visual && !visual.plain ? visual : null);
  }
  console.log(`  ${job.scenes.length} sahne, ${images.filter(Boolean).length} görsel`);

  const music = await pickMusic(settings.music, dir);
  console.log('  çizim render (Remotion)…');
  const videoPath = await renderEncyclopedia({ job, settings, fmt, narrated, images, music, dir });
  const thumbnailPath = job.type === 'long' ? await encyclopediaThumbnail({ job, settings, dir }) : null;

  const credits = [...new Set([music?.credit, ...images.map((v) => v?.credit)].filter(Boolean))];
  return { videoPath, thumbnailPath, duration: narrated.total, credits };
}
