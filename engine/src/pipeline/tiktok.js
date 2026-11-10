// TikTok Content Posting API (ücretsiz). Hesap bilgisi Firestore'da: secrets/tt_<kanalId> { openId, accessToken,
// refreshToken, expiresAt, refreshExpiresAt }; uygulama anahtarı secrets/tiktok_app { clientKey, clientSecret }.
// İki mod: 'taslak' (video TikTok gelen kutusuna düşer, kullanıcı tek dokunuşla paylaşır; onaysız uygulamada da çalışır)
// ve 'direkt' (TikTok uygulamayı onayladıktan sonra: doğrudan herkese açık paylaşım).
import fs from 'node:fs';

const API = 'https://open.tiktokapis.com/v2';

export class TtIzinHatasi extends Error {}

async function istek(method, url, token, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  const kod = data.error?.code;
  if (kod && kod !== 'ok') {
    const msg = `TikTok: ${data.error.message || kod} (${kod})`;
    throw /access_token|scope|unauthorized|permission|token/i.test(kod) ? new TtIzinHatasi(msg) : new Error(msg);
  }
  if (!res.ok) throw new Error(`TikTok HTTP ${res.status}`);
  return data.data ?? {};
}

export async function tokenAl({ clientKey, clientSecret }, params) {
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...params }),
  });
  const d = await res.json();
  if (d.error || !d.access_token) throw new TtIzinHatasi(`TikTok token alınamadı: ${d.error_description || d.error || 'yanıt yok'}`);
  const now = Date.now();
  return {
    openId: d.open_id, accessToken: d.access_token, refreshToken: d.refresh_token, scope: d.scope,
    expiresAt: new Date(now + (d.expires_in - 300) * 1000), refreshExpiresAt: new Date(now + d.refresh_expires_in * 1000),
  };
}

// Erişim token'ı 24 saat geçerli; süresi dolmuşsa yenilenir (yeni kayıt döner, gerek yoksa null).
export async function ttYenile(app, tt) {
  const bitis = tt.expiresAt?.toMillis?.() ?? new Date(tt.expiresAt).getTime();
  if (bitis > Date.now()) return null;
  return tokenAl(app, { grant_type: 'refresh_token', refresh_token: tt.refreshToken });
}

export async function ttKullanici(tt) {
  const r = await fetch(`${API}/user/info/?fields=open_id,display_name,username`, { headers: { Authorization: `Bearer ${tt.accessToken}` } });
  const d = await r.json();
  if (d.error?.code && d.error.code !== 'ok') throw new TtIzinHatasi(`TikTok: ${d.error.message || d.error.code}`);
  return d.data?.user ?? {};
}

// Videoyu yükler. mod 'taslak' → gelen kutusu; 'direkt' → herkese açık gönderi (onaylı uygulama gerekir).
export async function ttPaylas(tt, videoPath, { mod = 'taslak', baslik = '' } = {}) {
  const size = fs.statSync(videoPath).size;
  const source_info = { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 };
  let init;
  if (mod === 'direkt') {
    const c = await istek('POST', '/post/publish/creator_info/query/', tt.accessToken);
    const gizlilik = c.privacy_level_options?.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : c.privacy_level_options?.[0];
    init = await istek('POST', '/post/publish/video/init/', tt.accessToken, {
      post_info: { title: baslik.slice(0, 2200), privacy_level: gizlilik, disable_duet: false, disable_comment: false, disable_stitch: false, is_aigc: true },
      source_info,
    });
  } else {
    init = await istek('POST', '/post/publish/inbox/video/init/', tt.accessToken, { source_info });
  }
  const up = await fetch(init.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Content-Range': `bytes 0-${size - 1}/${size}` },
    body: fs.readFileSync(videoPath),
  });
  if (!up.ok) throw new Error(`TikTok yükleme HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
  return { publishId: init.publish_id };
}

export async function ttDurum(tt, publishId) {
  return istek('POST', '/post/publish/status/fetch/', tt.accessToken, { publish_id: publishId });
}

// TikTok açıklaması: başlık + hashtag'ler (TikTok'ta 2200 karakter sınırı)
export function ttAciklama(job) {
  // Sadece harf içeren etiketler (seri numarası "#38" ve TikTok'ta anlamsız "#shorts" alınmaz)
  const etiketler = (job.description?.match(/#[\p{L}\p{N}_]+/gu) ?? [])
    .filter((e) => /\p{L}/u.test(e) && e.toLowerCase() !== '#shorts').slice(0, 6);
  return `${job.title.trim()} ${[...etiketler, '#fyp'].join(' ')}`.trim().slice(0, 2200);
}
