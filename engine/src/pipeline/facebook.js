// Facebook sayfası Reels paylaşımı (Graph API, ücretsiz). Bilgi secrets/fb_<kanalId>: { pageId, token (istatistik), paylasToken }
// paylasToken: pages_manage_posts izinli süresiz sayfa token'ı. Bağlamak: node src/connect-facebook.js
// Instagram'ın Facebook'a kendiliğinden paylaşımı (Hesaplar Merkezi) açık olabilir: aynı video sayfada zaten varsa tekrar gönderilmez.
// Video, Instagram'la aynı bekleme sürümünden (instagram-bekleyen) imzalı adresle çekilir.
const API = 'https://graph.facebook.com/v23.0';

export class FbIzinHatasi extends Error {}
const izinHatasiMi = (e) => [190, 10, 102, 200].includes(e.code) || /permission|session|expired|OAuth|blocked/i.test(e.message ?? '');

async function graph(method, yol, token, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${API}/${yol}?${qs}`, { method });
  const data = await res.json();
  if (data.error) {
    const msg = `Facebook: ${data.error.error_user_msg || data.error.message}`;
    throw izinHatasiMi(data.error) ? new FbIzinHatasi(msg) : new Error(msg);
  }
  return data;
}

export const fbAciklama = (job) => `${job.title.trim()}\n\n${job.description.trim()}`.slice(0, 2200);

// Bağlantı sağlam mı? (paylaşım yapmadan)
const yt = (fb) => fb.paylasToken ?? fb.token;
export async function fbSaglik(fb) {
  await graph('GET', fb.pageId, yt(fb), { fields: 'id,name' });
}

// Sayfada son 2 günde aynı başlıkla bir Reels var mı (Instagram'dan otomatik gelmiş olabilir)
export async function fbZatenVar(fb, baslik) {
  const ilkSatir = (m) => String(m ?? '').trim().split(/\r?\n/)[0].toLowerCase();
  const ilk = ilkSatir(baslik);
  const d = await graph('GET', `${fb.pageId}/video_reels`, yt(fb), { fields: 'id,description,created_time', limit: '15' });
  return (d.data ?? []).find((x) => Date.now() - Date.parse(x.created_time) < 2 * 86400e3 && ilkSatir(x.description) === ilk) ?? null;
}

// Reels: başlat → Facebook videoyu adresten kendisi indirir → yayınla. Döner: { videoId, permalink }
export async function fbReelsPaylas(fb, videoUrl, aciklama) {
  const { pageId } = fb;
  const token = yt(fb);
  const { video_id: videoId, upload_url: yukleme } = await graph('POST', `${pageId}/video_reels`, token, { upload_phase: 'start' });
  const res = await fetch(yukleme ?? `https://rupload.facebook.com/video-upload/v23.0/${videoId}`, {
    method: 'POST', headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
  });
  const up = await res.json().catch(() => ({}));
  if (!res.ok || up.success === false) throw new Error(`Facebook yükleme: HTTP ${res.status} ${JSON.stringify(up).slice(0, 200)}`);
  await graph('POST', `${pageId}/video_reels`, token, { upload_phase: 'finish', video_id: videoId, video_state: 'PUBLISHED', description: aciklama });
  // İşlenmesini bekle (en çok 10 dk); yayın durumu "published" olunca bağlantı döner
  for (let i = 0; i < 60; i++) {
    const d = await graph('GET', videoId, token, { fields: 'status,permalink_url' });
    const durum = d.status?.video_status;
    if (durum === 'error') throw new Error(`Facebook videoyu işleyemedi: ${JSON.stringify(d.status).slice(0, 200)}`);
    if (d.status?.publishing_phase?.status === 'complete' || durum === 'ready') {
      return { videoId, permalink: d.permalink_url ? `https://www.facebook.com${d.permalink_url.replace(/^https?:\/\/[^/]+/, '')}` : null };
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return { videoId, permalink: null }; // yayınlandı ama işleme sürüyor
}
