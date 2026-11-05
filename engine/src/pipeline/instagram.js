// Instagram Reels gönderimi (Instagram Graph API, ücretsiz). Kanalın Instagram bilgisi secrets/ig_<kanalId>
// belgesinde: { userId, token } (Meta geliştirici panelindeki "Token oluştur" penceresinden, süresiz).
// API ileri saate zamanlamaya izin vermez: video üretilince GitHub'daki gizli bir sürüme (release) bırakılır,
// yayın saati geçince senkronizasyon indirip paylaşır ve dosyayı siler.
import fs from 'node:fs';
import path from 'node:path';
import { run, sleep } from '../lib/util.js';

const GRAPH = 'https://graph.facebook.com/v23.0';
const RELEASE = 'instagram-bekleyen';
const CAPTION_MAX = 2200;

async function graph(method, url, token, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${url}?${qs}`, { method });
  const data = await res.json();
  if (data.error) throw new Error(`Instagram: ${data.error.error_user_msg || data.error.message}`);
  return data;
}

export function caption(job) {
  // Instagram en fazla 30 etiket kabul eder; fazlası kesilir.
  let tags = 0;
  const text = `${job.title.trim()}\n\n${job.description.trim()}`
    .replace(/#[\p{L}\p{N}_]+/gu, (m) => (++tags <= 30 ? m : ''));
  return text.slice(0, CAPTION_MAX);
}

// Videoyu doğrudan yükler (herkese açık bir adres gerekmez), işlenmesini bekler ve paylaşır.
export async function publishReel({ userId, token }, videoPath, text) {
  const container = await graph('POST', `${userId}/media`, token, {
    media_type: 'REELS', upload_type: 'resumable', caption: text, share_to_feed: 'true', thumb_offset: '1000',
  });
  const size = fs.statSync(videoPath).size;
  const up = await fetch(container.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${container.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(size) },
    body: fs.readFileSync(videoPath),
  });
  if (!up.ok) throw new Error(`Instagram yükleme HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
  for (let i = 0; i < 60; i++) {
    const { status_code: status, status: detail } = await graph('GET', container.id, token, { fields: 'status_code,status' });
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram videoyu işleyemedi: ${detail ?? status}`);
    if (i === 59) throw new Error('Instagram videoyu 10 dakikada işleyemedi');
    await sleep(10_000);
  }
  const { id } = await graph('POST', `${userId}/media_publish`, token, { creation_id: container.id });
  const { permalink } = await graph('GET', id, token, { fields: 'permalink' });
  return { mediaId: id, permalink };
}

// --- Bekletme: GitHub sürümünde (gh CLI, iş akışında GH_TOKEN ile) ---

async function ensureRelease() {
  try {
    await run('gh', ['release', 'view', RELEASE]);
  } catch {
    await run('gh', ['release', 'create', RELEASE, '--title', 'Instagram için bekleyen videolar', '--notes', 'Otomatik; paylaşılınca silinir.', '--prerelease']);
  }
}

export async function holdForInstagram(jobId, videoPath) {
  await ensureRelease();
  const file = path.join(path.dirname(videoPath), `${jobId}.mp4`);
  if (file !== videoPath) fs.copyFileSync(videoPath, file);
  await run('gh', ['release', 'upload', RELEASE, file, '--clobber']);
}

export async function fetchHeld(jobId, dir) {
  await run('gh', ['release', 'download', RELEASE, '--pattern', `${jobId}.mp4`, '--dir', dir, '--clobber']);
  return path.join(dir, `${jobId}.mp4`);
}

export async function dropHeld(jobId) {
  await run('gh', ['release', 'delete-asset', RELEASE, `${jobId}.mp4`, '--yes']).catch(() => {});
}
