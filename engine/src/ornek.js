// Örnek video: bir senaryoyu kanalın ayarlarıyla üretir ama YouTube'a yüklemez (iş akışı çıktıyı indirilebilir dosya yapar).
// Kullanım: node src/ornek.js <senaryo.json> <çıktı klasörü>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from './lib/firebase.js';
import { resolveSettings } from './lib/options.js';
import { buildVideo } from './pipeline/build.js';
import { validateJob } from './validate.js';

const [file, out] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = validateJob(job);
if (errors.length) throw new Error(`senaryo geçersiz:\n- ${errors.join('\n- ')}`);
const settings = resolveSettings((await db().doc(`channels/${job.channelId}`).get()).data()?.settings);
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ornek-'));
const built = await buildVideo(job, settings, { workDir, cacheDir: workDir });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(built.videoPath, path.join(out, `${job.id}.mp4`));
if (built.thumbnailPath) fs.copyFileSync(built.thumbnailPath, path.join(out, `${job.id}-kapak${path.extname(built.thumbnailPath)}`));
console.log(`✓ ${job.id}: ${Math.round(built.duration)} sn`);
