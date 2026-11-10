// Instagram'a gidecek Reels'ler: üretimde bekletmeye alınır, yayın saati geçince paylaşılır
// (senkronizasyon ve Shorts saatlerinde çalışan hafif "Instagram" iş akışı).
// Durum videos/{id}.instagram alanında: bekliyor → yayinlandi | hata (3 denemeden sonra)
//   | izin-hatasi (Meta bağlantıyı/izni engelledi: deneme harcanmaz, video bekler, bağlantı düzelince paylaşılır).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IgIzinHatasi, caption, dropHeld, fetchHeld, holdForInstagram, igSaglik, publishReel } from '../pipeline/instagram.js';
import { notify } from './notify.js';

const MAX_TRIES = 3;
const UYARI_ARASI_MS = 12 * 60 * 60 * 1000; // aynı bağlantı sorunu için en fazla 12 saatte bir bildirim

// Üretimden: YouTube yüklemesinden sonra (yalnızca Instagram'ı açık kanalların Shorts'ları).
export async function queueForInstagram(firestore, job, settings, videoPath) {
  if (job.type !== 'short' || !settings.instagram?.enabled) return;
  const ref = firestore.doc(`videos/${job.id}`);
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
      const r = await publishReel(ig, file, v.instagram.caption);
      await doc.ref.update({ 'instagram.durum': 'yayinlandi', 'instagram.permalink': r.permalink, 'instagram.at': now, 'instagram.hata': null });
      // İstenirse aynı video hikâyede de paylaşılır (videos/{id}.instagram.hikaye: true)
      if (v.instagram.hikaye) {
        try {
          await publishReel(ig, file, null, 'STORIES');
          await doc.ref.update({ 'instagram.hikayeDurum': 'yayinlandi' });
        } catch (e) {
          await doc.ref.update({ 'instagram.hikayeDurum': `hata: ${e.message.slice(0, 200)}` });
        }
      }
      await dropHeld(doc.id);
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
        await dropHeld(doc.id);
        await notify({ level: 'error', title: 'Instagram\'a gönderilemedi', body: `${v.title}: ${e.message.slice(0, 150)}`, channelId: v.channelId, videoId: doc.id });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
