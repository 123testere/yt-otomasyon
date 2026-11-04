// Kanalı telefondan bağlama: Google'ın cihaz kodu akışı (OAuth "TV ve sınırlı giriş cihazları" istemcisi).
// Kullanıcı google.com/device adresinde kodu girip kanalın hesabını seçer; uygulama izni alıp Firestore'a yazar.
// İstemci kimliği meta/oauth belgesinden okunur (yüklü uygulama istemcilerinin sırrı Google'a göre gizli sayılmaz).
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// "youtube" kapsamı yükleme, okuma, kanal kimliği ve YouTube Analytics raporlarını kapsar.
const SCOPE = 'https://www.googleapis.com/auth/youtube';

async function client() {
  const snap = await getDoc(doc(db, 'meta', 'oauth'));
  const c = snap.data();
  if (!c?.tvClientId || !c?.tvClientSecret) {
    throw new Error('Telefondan bağlama henüz ayarlanmadı (meta/oauth). Bilgisayardaki kuruluma bak.');
  }
  return c;
}

const form = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(body) });
  return { ok: res.ok, data: await res.json() };
}

// 1) Kod al: { userCode, url, deviceCode, interval, expiresAt }
export async function startDeviceFlow() {
  const c = await client();
  const { ok, data } = await post('https://oauth2.googleapis.com/device/code', { client_id: c.tvClientId, scope: SCOPE });
  if (!ok) throw new Error(data.error_description || data.error || 'Kod alınamadı');
  return {
    userCode: data.user_code, url: data.verification_url, deviceCode: data.device_code,
    interval: Math.max(5, data.interval ?? 5), expiresAt: Date.now() + data.expires_in * 1000,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 2) Kullanıcı onaylayana kadar bekle; iptal için signal.cancelled = true.
export async function waitForApproval(flow, signal = {}) {
  const c = await client();
  let interval = flow.interval;
  while (!signal.cancelled && Date.now() < flow.expiresAt) {
    await sleep(interval * 1000);
    const { ok, data } = await post('https://oauth2.googleapis.com/token', {
      client_id: c.tvClientId, client_secret: c.tvClientSecret, device_code: flow.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (ok) return data;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') { interval += 5; continue; }
    if (data.error === 'access_denied') throw new Error('İzin verilmedi.');
    throw new Error(data.error_description || data.error);
  }
  throw new Error(signal.cancelled ? 'İptal edildi.' : 'Kodun süresi doldu, yeniden dene.');
}

// 3) İzinle kanalı bul, kaydını aç (ya da yenile) ve izni sunucuya bırak.
export async function saveChannel(tokens, defaults) {
  if (!tokens.refresh_token) throw new Error('Kalıcı izin gelmedi. Google hesabından uygulama erişimini kaldırıp yeniden dene.');
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const ch = (await res.json()).items?.[0];
  if (!ch) throw new Error('Bu hesapta YouTube kanalı yok. Önce kanalı oluştur.');
  const ref = doc(db, 'channels', ch.id);
  const info = {
    title: ch.snippet.title, thumbnail: ch.snippet.thumbnails?.default?.url ?? null,
    connectedAt: serverTimestamp(), needsReconnect: false, fromApp: true,
  };
  const existing = await getDoc(ref);
  if (existing.exists()) await updateDoc(ref, info);
  else await setDoc(ref, { ...info, settings: defaults });
  await setDoc(doc(db, 'secrets', ch.id), { refreshToken: tokens.refresh_token, client: 'tv', updatedAt: serverTimestamp() });
  return { id: ch.id, title: ch.snippet.title, isNew: !existing.exists() };
}
