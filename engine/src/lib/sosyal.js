// Instagram, TikTok ve Facebook istatistikleri → Firestore sosyal/<kanalId> (uygulama gösterir, Claude analiz eder).
// İzni olmayan metrikler atlanır ve "eksikIzinler" listesine yazılır (kullanıcıya hangi iznin gerektiği gösterilir).
import { ttYenile } from '../pipeline/tiktok.js';

const ARALIK_MS = 6 * 60 * 60 * 1000; // en fazla 6 saatte bir

const fbGraph = 'https://graph.facebook.com/v23.0';
async function graph(base, url, token) {
  const r = await (await fetch(`${base}/${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`)).json();
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function instagram(ig) {
  const base = String(ig.token).startsWith('IG') ? 'https://graph.instagram.com/v23.0' : fbGraph;
  const eksik = new Set();
  const hesap = await graph(base, `${ig.userId}?fields=username,followers_count,media_count`, ig.token);
  const medya = (await graph(base, `${ig.userId}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=30`, ig.token)).data ?? [];
  const videolar = [];
  for (const m of medya) {
    const v = { id: m.id, baslik: (m.caption ?? '').split('\n')[0].slice(0, 90), tur: m.media_product_type, permalink: m.permalink, at: m.timestamp, begeni: m.like_count ?? 0, yorum: m.comments_count ?? 0 };
    try {
      const ins = (await graph(base, `${m.id}/insights?metric=views,reach,saved,shares,total_interactions`, ig.token)).data ?? [];
      for (const x of ins) v[{ views: 'izlenme', reach: 'erisim', saved: 'kaydetme', shares: 'paylasim', total_interactions: 'etkilesim' }[x.name] ?? x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? 0;
    } catch (e) {
      if (/permission|insights/i.test(e.message)) eksik.add('instagram_manage_insights');
    }
    videolar.push(v);
  }
  // Takipçilerin çevrimiçi olduğu saatler (yayın saati ayarı için en değerli veri)
  let aktifSaatler = null;
  try {
    const r = (await graph(base, `${ig.userId}/insights?metric=online_followers&period=lifetime`, ig.token)).data?.[0]?.values ?? [];
    const son = r.at(-1)?.value ?? r[0]?.value;
    if (son && Object.keys(son).length) {
      // Meta saatleri Pasifik saatiyle verir; İstanbul'a (+11 saat kışın, +10 yazın yaklaşık) çevrilir.
      aktifSaatler = Array.from({ length: 24 }, (_, h) => son[String((h - 11 + 24) % 24)] ?? 0);
    }
  } catch (e) {
    if (/permission|insights/i.test(e.message)) eksik.add('instagram_manage_insights');
  }
  let erisim28 = null;
  try {
    const r = (await graph(base, `${ig.userId}/insights?metric=reach&period=days_28`, ig.token)).data?.[0]?.values ?? [];
    erisim28 = r.at(-1)?.value ?? null;
  } catch { /* izin yok */ }
  return { kullanici: hesap.username, takipci: hesap.followers_count, gonderi: hesap.media_count, erisim28, aktifSaatler, videolar, eksikIzinler: [...eksik] };
}

async function tiktok(firestore, kanalId) {
  const sref = firestore.doc(`secrets/tt_${kanalId}`);
  let tt = (await sref.get()).data();
  const app = (await firestore.doc('secrets/tiktok_app').get()).data();
  if (!tt || !app) return null;
  const yeni = await ttYenile(app, tt);
  if (yeni) { await sref.update({ ...yeni, updatedAt: new Date() }); tt = { ...tt, ...yeni }; }
  const eksik = [];
  const al = async (url, body) => {
    const r = await fetch(`https://open.tiktokapis.com/v2${url}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${tt.accessToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json();
    if (d.error?.code && d.error.code !== 'ok') throw new Error(d.error.code);
    return d.data;
  };
  let hesap = {};
  try { hesap = (await al('/user/info/?fields=display_name,follower_count,likes_count,video_count')).user ?? {}; } catch { eksik.push('user.info.stats'); }
  let videolar = [];
  try {
    videolar = ((await al('/video/list/?fields=id,title,video_description,create_time,view_count,like_count,comment_count,share_count,share_url', { max_count: 20 })).videos ?? [])
      .map((v) => ({ id: v.id, baslik: (v.title || v.video_description || '').slice(0, 90), at: new Date(v.create_time * 1000).toISOString(), izlenme: v.view_count, begeni: v.like_count, yorum: v.comment_count, paylasim: v.share_count, permalink: v.share_url }));
  } catch { eksik.push('video.list'); }
  return { kullanici: hesap.display_name ?? null, takipci: hesap.follower_count ?? null, begeniToplam: hesap.likes_count ?? null, videoSayisi: hesap.video_count ?? null, videolar, eksikIzinler: eksik };
}

async function facebook(fb) {
  const sayfa = await graph(fbGraph, `${fb.pageId}?fields=name,followers_count,fan_count`, fb.token);
  let erisim28 = null;
  // Meta sayfa metriklerinin adı değişti; sırayla denenir
  for (const m of ['page_total_media_view_unique', 'page_media_view', 'page_impressions_unique']) {
    try {
      erisim28 = (await graph(fbGraph, `${fb.pageId}/insights?metric=${m}&period=days_28`, fb.token)).data?.[0]?.values?.at(-1)?.value ?? null;
      break;
    } catch { /* bu metrik yok, sonrakini dene */ }
  }
  let gonderiler = [];
  const eksik = [];
  try {
  gonderiler = ((await graph(fbGraph, `${fb.pageId}/posts?fields=id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)&limit=20`, fb.token)).data ?? [])
    .map((p) => ({ id: p.id, baslik: (p.message ?? '').split('\n')[0].slice(0, 90), at: p.created_time, permalink: p.permalink_url, begeni: p.reactions?.summary?.total_count ?? 0, yorum: p.comments?.summary?.total_count ?? 0, paylasim: p.shares?.count ?? 0 }));
  } catch (e) {
    if (/pages_read_user_content/.test(e.message)) eksik.push('pages_read_user_content');
  }
  return { sayfa: sayfa.name, takipci: sayfa.followers_count ?? sayfa.fan_count ?? null, erisim28, videolar: gonderiler, eksikIzinler: eksik };
}

// Senkronizasyondan: bağlı her platformun istatistiğini (6 saatte bir) günceller.
export async function sosyalGuncelle(firestore, now = new Date(), { zorla = false } = {}) {
  const kanallar = (await firestore.collection('channels').get()).docs;
  for (const k of kanallar) {
    const ref = firestore.doc(`sosyal/${k.id}`);
    const onceki = (await ref.get()).data();
    if (!zorla && onceki?.guncellendi && now - onceki.guncellendi.toMillis() < ARALIK_MS) continue;
    const veri = {};
    const ig = (await firestore.doc(`secrets/ig_${k.id}`).get()).data();
    if (ig?.token) veri.instagram = await instagram(ig).catch((e) => ({ hata: e.message.slice(0, 200) }));
    const tt = (await firestore.doc(`secrets/tt_${k.id}`).get()).exists ? await tiktok(firestore, k.id).catch((e) => ({ hata: e.message.slice(0, 200) })) : null;
    if (tt) veri.tiktok = tt;
    const fb = (await firestore.doc(`secrets/fb_${k.id}`).get()).data();
    if (fb?.token) veri.facebook = await facebook(fb).catch((e) => ({ hata: e.message.slice(0, 200) }));
    if (!Object.keys(veri).length) continue;
    // Günlük takipçi geçmişi (grafik için)
    const gun = now.toISOString().slice(0, 10);
    const gecmis = { ...(onceki?.gecmis ?? {}) };
    gecmis[gun] = { ig: veri.instagram?.takipci ?? null, tt: veri.tiktok?.takipci ?? null, fb: veri.facebook?.takipci ?? null };
    const gunler = Object.keys(gecmis).sort().slice(-90);
    await ref.set({ ...veri, gecmis: Object.fromEntries(gunler.map((g) => [g, gecmis[g]])), guncellendi: now }, { merge: false });
    console.log(`Sosyal ${k.data().title}: ${Object.keys(veri).join(', ')}`);
  }
}
