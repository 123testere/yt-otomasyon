// config/channels.json'dan güncel config/needed.json üretir (npm install gerekmez).
// Bulut rutini senaryo yazmadan önce bunu çalıştırır; saatlik senkron gecikse bile liste güncel olur.
import fs from 'node:fs';
import path from 'node:path';
import { neededJobs } from './lib/plan.js';
import { resolveSettings } from './lib/options.js';
import { CONFIG_DIR } from './lib/paths.js';
import { stableJson } from './lib/util.js';
import { akislariTazele } from './lib/haberler.js';

const channels = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'channels.json'), 'utf8'))
  .map((c) => ({ ...c, settings: resolveSettings(c.settings) }));
// Haber kanalları için güncel haber listesi (config/haberler-<akış>.json); senaryo konusu buradan seçilir.
await akislariTazele(channels).catch((e) => console.warn(`Haber akışı alınamadı: ${e.message}`));
const needed = neededJobs(channels);
fs.writeFileSync(path.join(CONFIG_DIR, 'needed.json'), stableJson(needed));
console.log(`${needed.length} video yazılmayı bekliyor.`);
for (const job of needed) console.log(`  ${job.id} (${job.type}, ${job.targetWords} kelime, yayın ${job.publishAt})`);
