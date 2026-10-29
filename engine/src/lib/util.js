import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} çıkış kodu ${code}: ${err.slice(-1500)}`)));
  });
}

export async function retry(fn, { tries = 3, delayMs = 3000, label = 'işlem' } = {}) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      console.warn(`  ${label} başarısız (${i}/${tries}): ${e.message}`);
      if (i < tries) await sleep(delayMs * i);
    }
  }
  throw last;
}

export async function download(url, dest, { headers = {}, timeoutMs = 180_000, minBytes = 1000 } = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) throw new Error(`Dosya çok küçük (${buf.length} bayt)`);
  await fs.writeFile(dest, buf);
  return dest;
}

export async function probeDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(out.trim());
}

export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return Math.abs(h) % 1_000_000;
}

export function stableJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}
