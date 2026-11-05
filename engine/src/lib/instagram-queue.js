// Instagram'a gidecek Reels'ler: üretimde bekletmeye alınır, yayın saati geçince senkronizasyon paylaşır.
// Durum videos/{id}.instagram alanında: bekliyor → yayinlandi | hata (3 denemeden sonra).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caption, dropHeld, fetchHeld, holdForInstagram, publishReel } from '../pipeline/instagram.js';
import { notify } from './notify.js';

const MAX_TRIES = 3;

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
  }
}

// Senkronizasyondan: yayın saati geçmiş bekleyenleri paylaş.
export async function publishDueReels(firestore, now = new Date()) {
  const snap = await firestore.collection('videos').where('instagram.durum', '==', 'bekliyor').get();
  for (const doc of snap.docs) {
    const v = doc.data();
    if (v.instagram.yayin.toMillis() > now.getTime()) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-'));
    try {
      const ig = (await firestore.doc(`secrets/ig_${v.channelId}`).get()).data();
      if (!ig?.token) throw new Error('Kanalın Instagram hesabı bağlı değil');
      const file = await fetchHeld(doc.id, dir);
      const r = await publishReel(ig, file, v.instagram.caption);
      await doc.ref.update({ 'instagram.durum': 'yayinlandi', 'instagram.permalink': r.permalink, 'instagram.at': now, 'instagram.hata': null });
      await dropHeld(doc.id);
      console.log(`✓ Instagram: ${v.title} ${r.permalink}`);
      await notify({ title: 'Instagram\'da yayınlandı', body: v.title, channelId: v.channelId, videoId: doc.id });
    } catch (e) {
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
