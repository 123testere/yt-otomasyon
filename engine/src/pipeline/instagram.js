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

// Taslağın (container) işlenmesini bekler. FINISHED olursa true; süre dolarsa false; hata durumunda fırlatır.
async function islenmesiniBekle(containerId, token, saniye) {
  for (let gecen = 0; ; gecen += 6) {
    const { status_code: status, status: detail } = await graph('GET', containerId, token, { fields: 'status_code,status' });
    if (status === 'FINISHED') return true;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram videoyu işleyemedi: ${detail ?? status}`);
    if (gecen >= saniye) return false;
    await sleep(6000);
  }
}

// Videoyu paylaşır. tur: 'REELS' (varsayılan) ya da 'STORIES' (hikâye; açıklama yazısı kullanılmaz).
// İki yükleme yolu var:
//  1) Adresten çekme (video_url): Instagram dosyayı verilen adresten kendisi indirir ve arka planda işler.
//     Zaman sınırı yoktur; asıl yol budur. `adres` her denemede taze bir geçici adres döndüren fonksiyondur.
//  2) Doğrudan yükleme (resumable): Instagram videoyu ~30 sn içinde işleyemezse "ProcessingFailedError" (HTTP 400)
//     döner; işleme süresi video uzunluğuyla arttığından ~30 sn'den uzun videolarda neredeyse hep düşer
//     (Kasım 2026'da Reels'lerin gitmeme sebebi). Yalnızca yedek yol olarak kalır; 400'den sonra taslak yine de
//     hazır olabildiği için bir süre durumu yoklanır.
// Yayınlama (media_publish) yalnızca bir kez çağrılır.
export async function publishReel({ userId, token }, videoPath, text, tur = 'REELS', { adres = null } = {}) {
  const ortak = tur === 'STORIES' ? { media_type: 'STORIES' } : { media_type: 'REELS', caption: text, share_to_feed: 'true', thumb_offset: '1000' };
  const adresten = async () => {
    const container = await graph('POST', `${userId}/media`, token, { ...ortak, video_url: await adres() });
    if (!(await islenmesiniBekle(container.id, token, 600))) throw new Error('Instagram videoyu 10 dakikada işleyemedi');
    return container.id;
  };
  const dogrudan = async () => {
    const veri = fs.readFileSync(videoPath);
    const container = await graph('POST', `${userId}/media`, token, { ...ortak, upload_type: 'resumable' });
    const up = await fetch(container.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${container.id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(veri.length) },
      body: veri,
    });
    if (up.ok) {
      if (!(await islenmesiniBekle(container.id, token, 600))) throw new Error('Instagram videoyu 10 dakikada işleyemedi');
      return container.id;
    }
    const hata = `Instagram yükleme HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`;
    if (await islenmesiniBekle(container.id, token, 90).catch(() => false)) return container.id;
    throw new Error(hata);
  };
  const yollar = adres ? [['adresten', adresten], ['adresten', adresten], ['doğrudan', dogrudan], ['adresten', adresten]] : [['doğrudan', dogrudan], ['doğrudan', dogrudan], ['doğrudan', dogrudan]];
  let containerId = null;
  let son = null;
  for (let i = 0; i < yollar.length && !containerId; i++) {
    const [ad, yol] = yollar[i];
    try {
      containerId = await yol();
    } catch (e) {
      if (e instanceof IgIzinHatasi) throw e;
      son = e;
      console.warn(`  Instagram yükleme denemesi ${i + 1}/${yollar.length} (${ad}): ${e.message}`);
      if (i < yollar.length - 1) await sleep(15_000 * (i + 1));
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

// Bekleyen dosyanın geçici, imzalı indirme adresi (yaklaşık 1 saat geçerli, oturum gerektirmez).
// Depo gizli olsa da Instagram videoyu bu adresten çekebilir.
export async function heldUrl(jobId) {
  const repo = process.env.GITHUB_REPOSITORY || (await run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])).trim();
  const assetId = (await run('gh', ['api', `repos/${repo}/releases/tags/${RELEASE}`, '-q', `.assets[] | select(.name=="${jobId}.mp4") | .id`])).trim();
  if (!assetId) throw new Error(`Bekleyen video bulunamadı: ${jobId}.mp4`);
  const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || (await run('gh', ['auth', 'token'])).trim();
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${assetId}`, {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/octet-stream' },
    redirect: 'manual',
  });
  const url = res.headers.get('location');
  if (!url) throw new Error(`Bekleyen videonun indirme adresi alınamadı (HTTP ${res.status})`);
  return url;
}
