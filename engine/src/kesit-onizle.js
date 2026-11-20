// Kesit işlerini YouTube'a yüklemeden üretir (önizleme). Kullanım: node src/kesit-onizle.js <iş klasörü> <çıktı klasörü>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildKesit } from './pipeline/build-kesit.js';
import { validateJob } from './validate.js';

const [girdi, cikti] = process.argv.slice(2);
fs.mkdirSync(cikti, { recursive: true });
const settings = { language: 'en', voice: 'en-US-GuyNeural', speechRate: '+30%' };
for (const f of fs.readdirSync(girdi).filter((x) => x.endsWith('.json'))) {
  const job = JSON.parse(fs.readFileSync(path.join(girdi, f), 'utf8'));
  const hatalar = validateJob(job, { fileId: job.id });
  if (hatalar.length) { console.log(`✗ ${job.id}: ${hatalar.join('; ')}`); continue; }
  try {
    const r = await buildKesit(job, settings, { workDir: fs.mkdtempSync(path.join(os.tmpdir(), 'kesit-')) });
    const ad = `${job.kampanya}.mp4`;
    fs.copyFileSync(r.videoPath, path.join(cikti, ad));
    fs.writeFileSync(path.join(cikti, `${job.kampanya}.json`), JSON.stringify(job, null, 2));
    console.log(`✓ ${ad} (${Math.round(r.duration)} sn) — ${job.title}`);
  } catch (e) {
    console.log(`✗ ${job.id}: ${e.stderr?.toString().trim().split('\n').at(-1) ?? e.message}`);
  }
}
