// Instagram Reels gönderimi (Instagram Graph API, ücretsiz). Kanalın Instagram bilgisi secrets/ig_<kanalId>
// belgesinde: { userId, token } (Meta geliştirici panelindeki "Token oluştur" penceresinden, süresiz).
// API ileri saate zamanlamaya izin vermez: video üretilince GitHub'daki gizli bir sürüme (release) bırakılır,
// yayın saati geçince senkronizasyon indirip paylaşır ve dosyayı siler.
import fs from 'node:fs';
import path from 'node:path';
import { run, sleep } from '../lib/util.js';

// Facebook girişli token (EAA…) graph.facebook.com, Instagram girişli token (IGAA…) graph.instagram.com kullanır.
const graphOf = (token) => (String(token).startsWith('IG') ? 'https://graph.instagram.com/v23.0' : 'https://graph.facebook.com/v23.0');
const RELEASE = 'instagram-bekleyen';
const CAPTION_MAX = 2200;

// Bağlantı/izin hatası (token geçersiz, uygulama engellendi, izin geri alındı): tekrar denemek işe yaramaz,
// kullanıcı Meta tarafında düzeltene kadar video bekletilir ve hemen haber verilir.
export class IgIzinHatasi extends Error {}

const izinHatasiMi = (e) => [190, 10, 102, 200].includes(e.code) || /blocked|on behalf of user|permission|session|expired|OAuth/i.test(e.message ?? '');

async function graph(method, url, token, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${graphOf(token)}/${url}?${qs}`, { method });
  const data = await res.json();
  if (data.error) {
    const msg = `Instagram: ${data.error.error_user_msg || data.error.message}`;
    throw izinHatasiMi(data.error) ? new IgIzinHatasi(msg) : new Error(msg);
  }
  return data;
}

// Instagram girişli token 60 gün geçerlidir; 30 günden eskiyse yenilenir (yeni token döner, yoksa null).
export async function igTokenYenile({ token, updatedAt }) {
  if (!String(token).startsWith('IG')) return null;
  const yas = Date.now() - (updatedAt?.toMillis?.() ?? 0);
  if (yas < 30 * 24 * 3600 * 1000) return null;
  const r = await (await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`)).json();
  if (r.error || !r.access_token) throw new IgIzinHatasi(`Instagram token yenilenemedi: ${r.error?.message ?? 'yanıt yok'}`);
  return r.access_token;
}

// Bağlantı sağlam mı? (paylaşım yapmadan, sadece okuma)
export async function igSaglik({ userId, token }) {
  await graph('GET', `${userId}/content_publishing_limit`, token, { fields: 'quota_usage' });
}

export function caption(job) {
  // Instagram en fazla 30 etiket kabul eder; fazlası kesilir.
  let tags = 0;
  const text = `${job.title.trim()}\n\n${job.description.trim()}`
    .replace(/#[\p{L}\p{N}_]+/gu, (m) => (++tags <= 30 ? m : ''));
  return text.slice(0, CAPTION_MAX);
}

// Videoyu doğrudan yükler (herkese açık bir adres gerekmez), işlenmesini bekler ve paylaşır.
// tur: 'REELS' (varsayılan) ya da 'STORIES' (hikâye; açıklama yazısı kullanılmaz).
export async function publishReel({ userId, token }, videoPath, text, tur = 'REELS') {
  const size = fs.statSync(videoPath).size;
  const veri = fs.readFileSync(videoPath);
  // Yükleme ve işleme adımı Instagram tarafında ara sıra geçici hata verir ("ProcessingFailedError"):
  // her denemede yeni bir taslak açılıp baştan yüklenir. Yayınlama (media_publish) yalnızca bir kez çağrılır.
  let containerId = null;
  let son = null;
  for (let deneme = 1; deneme <= 4 && !containerId; deneme++) {
    try {
      const container = await graph('POST', `${userId}/media`, token, tur === 'STORIES'
        ? { media_type: 'STORIES', upload_type: 'resumable' }
        : { media_type: 'REELS', upload_type: 'resumable', caption: text, share_to_feed: 'true', thumb_offset: '1000' });
      const up = await fetch(container.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${container.id}`, {
        method: 'POST',
        headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(size) },
        body: veri,
      });
      if (!up.ok) throw new Error(`Instagram yükleme HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
      for (let i = 0; i < 60; i++) {
        const { status_code: status, status: detail } = await graph('GET', container.id, token, { fields: 'status_code,status' });
        if (status === 'FINISHED') break;
        if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram videoyu işleyemedi: ${detail ?? status}`);
        if (i === 59) throw new Error('Instagram videoyu 10 dakikada işleyemedi');
        await sleep(10_000);
      }
      containerId = container.id;
    } catch (e) {
      if (e instanceof IgIzinHatasi) throw e;
      son = e;
      console.warn(`  Instagram yükleme denemesi ${deneme}/4: ${e.message}`);
      if (deneme < 4) await sleep(20_000 * deneme);
    }
  }
  if (!containerId) throw son;
  const { id } = await graph('POST', `${userId}/media_publish`, token, { creation_id: containerId });
  const { permalink } = await graph('GET', id, token, { fields: 'permalink' }).catch(() => ({ permalink: null }));
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
