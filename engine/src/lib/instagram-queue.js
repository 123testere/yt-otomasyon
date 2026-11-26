// Instagram'a gidecek Reels'ler: üretimde bekletmeye alınır, yayın saati geçince paylaşılır
// (senkronizasyon ve Shorts saatlerinde çalışan hafif "Instagram" iş akışı).
// Durum videos/{id}.instagram alanında: bekliyor → yayinlandi | hata (3 denemeden sonra)
//   | izin-hatasi (Meta bağlantıyı/izni engelledi: deneme harcanmaz, video bekler, bağlantı düzelince paylaşılır).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IgIzinHatasi, caption, dropHeld, fetchHeld, heldUrl, holdForInstagram, igSaglik, igTokenYenile, publishReel } from '../pipeline/instagram.js';
import { notify } from './notify.js';
import { FbIzinHatasi, fbAciklama, fbReelsPaylas, fbSaglik } from '../pipeline/facebook.js';
import { TtIzinHatasi, ttAciklama, ttPaylas, ttYenile } from '../pipeline/tiktok.js';

const MAX_TRIES = 3;
// Aynı videoyu bekleyen başka platform var mı (bekleme dosyası o zaman silinmez)
const digerBekliyor = (v, ben) => ['instagram', 'tiktok', 'facebook'].some((p) => p !== ben && ['bekliyor', 'izin-hatasi'].includes(v[p]?.durum));
const UYARI_ARASI_MS = 12 * 60 * 60 * 1000; // aynı bağlantı sorunu için en fazla 12 saatte bir bildirim

// Üretimden: YouTube yüklemesinden sonra (Instagram ve/veya TikTok'u açık kanalların Shorts'ları).
// Video GitHub'daki bekleme sürümüne bir kez konur; iki platform da işini bitirince silinir.
export async function queueForInstagram(firestore, job, settings, videoPath) {
  if (job.type !== 'short') return;
  const ref = firestore.doc(`videos/${job.id}`);
  if (settings.tiktok?.enabled) {
    try {
      if (!(await firestore.doc(`secrets/tt_${job.channelId}`).get()).exists) throw new Error('Kanalın TikTok hesabı bağlı değil');
      await holdForInstagram(job.id, videoPath);
      await ref.update({ tiktok: { durum: 'bekliyor', yayin: new Date(job.publishAt), aciklama: ttAciklama(job), mod: settings.tiktok.mod ?? 'taslak', deneme: 0 } });
    } catch (e) {
      await ref.update({ tiktok: { durum: 'hata', hata: e.message.slice(0, 300) } });
      await notify({ level: 'error', title: 'TikTok sırasına alınamadı', body: `${job.title}: ${e.message.slice(0, 150)}`, channelId: job.channelId, videoId: job.id });
    }
  }
  if (settings.facebook?.enabled) {
    try {
      if (!(await firestore.doc(`secrets/fb_${job.channelId}`).get()).exists) throw new Error('Kanalın Facebook sayfası bağlı değil');
      await holdForInstagram(job.id, videoPath);
      await ref.update({ facebook: { durum: 'bekliyor', yayin: new Date(job.publishAt), aciklama: fbAciklama(job), deneme: 0 } });
    } catch (e) {
      await ref.update({ facebook: { durum: 'hata', hata: e.message.slice(0, 300) } });
      await notify({ level: 'error', title: 'Facebook sırasına alınamadı', body: `${job.title}: ${e.message.slice(0, 150)}`, channelId: job.channelId, videoId: job.id });
    }
  }
  if (!settings.instagram?.enabled) return;
  try {
    if (!(await firestore.doc(`secrets/ig_${job.channelId}`).get()).exists) throw new Error('Kanalın Instagram hesabı bağlı değil');
    await holdForInstagram(job.id, videoPath);
    await ref.update({ instagram: { durum: 'bekliyor', yayin: new Date(job.publishAt), caption: caption(job), deneme: 0 } });
  } catch (e) {
    await ref.update({ instagram: { durum: 'hata', hata: e.message.slice(0, 300) } });
    await notify({ level: 'error', title: 'Instagram sırasına alınamadı', body: `${job.title}: ${e.message.slice(0, 150)}`, channelId: job.channelId, videoId: job.id });
  }
}

// Kanalın Instagram bağlantısı bozuksa kanala işaret koyar ve (12 saatte bir) haber verir.
async function baglantiBozuk(firestore, channelId, mesaj, bekleyen) {
  const ref = firestore.doc(`channels/${channelId}`);
  const onceki = (await ref.get()).data()?.instagramHata;
  await ref.set({ instagramHata: { mesaj: mesaj.slice(0, 300), at: new Date(), bekleyen } }, { merge: true });
  if (onceki?.at && Date.now() - onceki.at.toMillis() < UYARI_ARASI_MS) return;
  await notify({
    level: 'error',
    title: 'Instagram bağlantısı çalışmıyor',
    body: `Reels paylaşılamıyor (${bekleyen} video bekliyor). Meta geliştirici panelinde uygulamanın durumuna bak ya da yeni token ver. Hata: ${mesaj.slice(0, 120)}`,
    channelId,
  });
}

// Bağlantı yeniden çalışınca: işareti kaldır, izin hatasıyla bekleyenleri tekrar sıraya koy.
async function baglantiDuzeldi(firestore, channelId) {
  const ref = firestore.doc(`channels/${channelId}`);
  if (!(await ref.get()).data()?.instagramHata) return 0;
  await ref.update({ instagramHata: null });
  const snap = await firestore.collection('videos').where('instagram.durum', '==', 'izin-hatasi').get();
  const bizim = snap.docs.filter((d) => d.data().channelId === channelId);
  for (const d of bizim) await d.ref.update({ 'instagram.durum': 'bekliyor', 'instagram.deneme': 0 });
  await notify({ title: 'Instagram bağlantısı düzeldi', body: `${bizim.length} bekleyen Reels şimdi paylaşılıyor.`, channelId });
  return bizim.length;
}

// Instagram'ı açık her kanalın bağlantısını yoklar (paylaşım yapmadan). Senkronizasyon ve Instagram iş akışı çağırır.
export async function instagramSaglik(firestore) {
  const kanallar = (await firestore.collection('channels').get()).docs.filter((d) => d.data().settings?.instagram?.enabled);
  for (const k of kanallar) {
    const ig = (await firestore.doc(`secrets/ig_${k.id}`).get()).data();
    if (!ig?.token) continue;
    const bekleyen = (await firestore.collection('videos').where('channelId', '==', k.id).get()).docs
      .filter((d) => ['bekliyor', 'izin-hatasi'].includes(d.data().instagram?.durum)).length;
    try {
      const yeni = await igTokenYenile(ig);
      if (yeni) { await firestore.doc(`secrets/ig_${k.id}`).update({ token: yeni, updatedAt: new Date() }); ig.token = yeni; console.log(`Instagram ${k.id}: token yenilendi.`); }
      await igSaglik(ig);
      const n = await baglantiDuzeldi(firestore, k.id);
      if (n) console.log(`Instagram ${k.id}: bağlantı düzeldi, ${n} Reels yeniden sırada.`);
    } catch (e) {
      if (!(e instanceof IgIzinHatasi)) { console.warn(`Instagram ${k.id} sağlık: ${e.message}`); continue; }
      console.warn(`✗ Instagram ${k.id} bağlantısı bozuk: ${e.message}`);
      await baglantiBozuk(firestore, k.id, e.message, bekleyen);
    }
  }
}

// Yayın saati geçmiş bekleyenleri paylaş.
export async function publishDueReels(firestore, now = new Date()) {
  await instagramSaglik(firestore);
  const snap = await firestore.collection('videos').where('instagram.durum', '==', 'bekliyor').get();
  const bozuk = new Set();
  for (const doc of snap.docs) {
    const v = doc.data();
    if (v.instagram.yayin.toMillis() > now.getTime()) continue;
    if (bozuk.has(v.channelId)) { await doc.ref.update({ 'instagram.durum': 'izin-hatasi' }); continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-'));
    try {
      const ig = (await firestore.doc(`secrets/ig_${v.channelId}`).get()).data();
      if (!ig?.token) throw new IgIzinHatasi('Kanalın Instagram hesabı bağlı değil');
      const file = await fetchHeld(doc.id, dir);
      const adres = () => heldUrl(doc.id);
      const r = await publishReel(ig, file, v.instagram.caption, 'REELS', { adres });
      await doc.ref.update({ 'instagram.durum': 'yayinlandi', 'instagram.permalink': r.permalink, 'instagram.at': now, 'instagram.hata': null });
      // İstenirse aynı video hikâyede de paylaşılır (videos/{id}.instagram.hikaye: true)
      if (v.instagram.hikaye) {
        try {
          await publishReel(ig, file, null, 'STORIES', { adres });
          await doc.ref.update({ 'instagram.hikayeDurum': 'yayinlandi' });
        } catch (e) {
          await doc.ref.update({ 'instagram.hikayeDurum': `hata: ${e.message.slice(0, 200)}` });
        }
      }
      if (!digerBekliyor(v, 'instagram')) await dropHeld(doc.id);
      const gecikme = Math.round((now.getTime() - v.instagram.yayin.toMillis()) / 60000);
      console.log(`✓ Instagram: ${v.title} ${r.permalink} (${gecikme} dk gecikme)`);
      await notify({ title: 'Instagram\'da yayınlandı', body: v.title, channelId: v.channelId, videoId: doc.id });
    } catch (e) {
      if (e instanceof IgIzinHatasi) {
        // Bağlantı sorunu: deneme hakkı harcanmaz, video silinmez; kullanıcıya hemen haber verilir.
        bozuk.add(v.channelId);
        await doc.ref.update({ 'instagram.durum': 'izin-hatasi', 'instagram.hata': e.message.slice(0, 300) });
        await baglantiBozuk(firestore, v.channelId, e.message, snap.size);
        console.warn(`✗ Instagram ${doc.id}: bağlantı/izin hatası: ${e.message}`);
        continue;
      }
      const deneme = (v.instagram.deneme ?? 0) + 1;
      const bitti = deneme >= MAX_TRIES;
      await doc.ref.update({ 'instagram.deneme': deneme, 'instagram.hata': e.message.slice(0, 300), 'instagram.durum': bitti ? 'hata' : 'bekliyor' });
      console.warn(`✗ Instagram ${doc.id} (${deneme}. deneme): ${e.message}`);
      if (bitti) {
        if (!digerBekliyor(v, 'instagram')) await dropHeld(doc.id);
        await notify({ level: 'error', title: 'Instagram\'a gönderilemedi', body: `${v.title}: ${e.message.slice(0, 150)}`, channelId: v.channelId, videoId: doc.id });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

// TikTok: yayın saati gelen videolar gönderilir. 'taslak' modunda TikTok gelen kutusuna düşer (kullanıcı paylaşır),
// 'direkt' modunda herkese açık yayınlanır. Bağlantı/izin hatasında video bekler ve hemen haber verilir.
export async function publishDueTiktok(firestore, now = new Date()) {
  const snap = await firestore.collection('videos').where('tiktok.durum', '==', 'bekliyor').get();
  if (snap.empty) return;
  const app = (await firestore.doc('secrets/tiktok_app').get()).data();
  const bozuk = new Set();
  for (const doc of snap.docs) {
    const v = doc.data();
    if (v.tiktok.yayin.toMillis() > now.getTime() || bozuk.has(v.channelId)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
    const sref = firestore.doc(`secrets/tt_${v.channelId}`);
    try {
      let tt = (await sref.get()).data();
      if (!tt || !app) throw new TtIzinHatasi('Kanalın TikTok hesabı bağlı değil');
      const yeni = await ttYenile(app, tt);
      if (yeni) { await sref.update({ ...yeni, updatedAt: new Date() }); tt = { ...tt, ...yeni }; }
      const file = await fetchHeld(doc.id, dir);
      const r = await ttPaylas(tt, file, { mod: v.tiktok.mod, baslik: v.tiktok.aciklama });
      const taslak = v.tiktok.mod !== 'direkt';
      await doc.ref.update({ 'tiktok.durum': taslak ? 'taslak-gonderildi' : 'yayinlandi', 'tiktok.publishId': r.publishId, 'tiktok.at': now, 'tiktok.hata': null });
      if (!digerBekliyor(v, 'tiktok')) await dropHeld(doc.id);
      await firestore.doc(`channels/${v.channelId}`).set({ tiktokHata: null }, { merge: true });
      console.log(`✓ TikTok (${taslak ? 'taslak' : 'yayın'}): ${v.title}`);
      await notify({
        title: taslak ? 'TikTok: paylaşmaya hazır' : 'TikTok\'ta yayınlandı',
        body: taslak ? `TikTok gelen kutundaki taslağı aç, şu açıklamayı yapıştır ve paylaş:
${v.tiktok.aciklama}` : v.title,
        channelId: v.channelId, videoId: doc.id,
      });
    } catch (e) {
      if (e instanceof TtIzinHatasi) {
        bozuk.add(v.channelId);
        await doc.ref.update({ 'tiktok.durum': 'izin-hatasi', 'tiktok.hata': e.message.slice(0, 300) });
        const cref = firestore.doc(`channels/${v.channelId}`);
        const onceki = (await cref.get()).data()?.tiktokHata;
        await cref.set({ tiktokHata: { mesaj: e.message.slice(0, 300), at: new Date() } }, { merge: true });
        if (!onceki?.at || Date.now() - onceki.at.toMillis() >= UYARI_ARASI_MS) {
          await notify({ level: 'error', title: 'TikTok bağlantısı çalışmıyor', body: `Videolar bekletiliyor. Hesabı yeniden bağla (node src/connect-tiktok.js). Hata: ${e.message.slice(0, 120)}`, channelId: v.channelId });
        }
        console.warn(`✗ TikTok ${doc.id}: bağlantı hatası: ${e.message}`);
        continue;
      }
      const deneme = (v.tiktok.deneme ?? 0) + 1;
      await doc.ref.update({ 'tiktok.deneme': deneme, 'tiktok.hata': e.message.slice(0, 300), 'tiktok.durum': deneme >= MAX_TRIES ? 'hata' : 'bekliyor' });
      console.warn(`✗ TikTok ${doc.id} (${deneme}. deneme): ${e.message}`);
      if (deneme >= MAX_TRIES) await notify({ level: 'error', title: 'TikTok\'a gönderilemedi', body: `${v.title}: ${e.message.slice(0, 150)}`, channelId: v.channelId, videoId: doc.id });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

// Facebook sayfası Reels: yayın saati gelenler paylaşılır; bağlantı hatasında video bekler ve haber verilir.
export async function publishDueFacebook(firestore, now = new Date()) {
  const snap = await firestore.collection('videos').where('facebook.durum', 'in', ['bekliyor', 'izin-hatasi']).get();
  const bozuk = new Set();
  for (const doc of snap.docs) {
    const v = doc.data();
    if (v.facebook.yayin.toMillis() > now.getTime() || bozuk.has(v.channelId)) continue;
    try {
      const fb = (await firestore.doc(`secrets/fb_${v.channelId}`).get()).data();
      if (!fb?.token) throw new FbIzinHatasi('Kanalın Facebook sayfası bağlı değil');
      await fbSaglik(fb);
      const r = await fbReelsPaylas(fb, await heldUrl(doc.id), v.facebook.aciklama);
      await doc.ref.update({ 'facebook.durum': 'yayinlandi', 'facebook.videoId': r.videoId, 'facebook.permalink': r.permalink, 'facebook.at': now, 'facebook.hata': null });
      if (!digerBekliyor(v, 'facebook')) await dropHeld(doc.id);
      await firestore.doc(`channels/${v.channelId}`).set({ facebookHata: null }, { merge: true });
      console.log(`✓ Facebook: ${v.title} ${r.permalink ?? r.videoId}`);
      await notify({ title: "Facebook'ta yayınlandı", body: v.title, channelId: v.channelId, videoId: doc.id });
    } catch (e) {
      if (e instanceof FbIzinHatasi) {
        bozuk.add(v.channelId);
        await doc.ref.update({ 'facebook.durum': 'izin-hatasi', 'facebook.hata': e.message.slice(0, 300) });
        const cref = firestore.doc(`channels/${v.channelId}`);
        const onceki = (await cref.get()).data()?.facebookHata;
        await cref.set({ facebookHata: { mesaj: e.message.slice(0, 300), at: new Date() } }, { merge: true });
        if (!onceki?.at || Date.now() - onceki.at.toMillis() >= UYARI_ARASI_MS) {
          await notify({ level: 'error', title: 'Facebook bağlantısı çalışmıyor', body: `Reels bekletiliyor. Sayfayı yeniden bağla (node src/connect-facebook.js). Hata: ${e.message.slice(0, 120)}`, channelId: v.channelId });
        }
        console.warn(`✗ Facebook ${doc.id}: bağlantı hatası: ${e.message}`);
        continue;
      }
      const deneme = (v.facebook.deneme ?? 0) + 1;
      await doc.ref.update({ 'facebook.deneme': deneme, 'facebook.hata': e.message.slice(0, 300), 'facebook.durum': deneme >= MAX_TRIES ? 'hata' : 'bekliyor' });
      console.warn(`✗ Facebook ${doc.id} (${deneme}. deneme): ${e.message}`);
      if (deneme >= MAX_TRIES) {
        if (!digerBekliyor(v, 'facebook')) await dropHeld(doc.id);
        await notify({ level: 'error', title: "Facebook'a gönderilemedi", body: `${v.title}: ${e.message.slice(0, 150)}`, channelId: v.channelId, videoId: doc.id });
      }
    }
  }
}
