// Yayından önce bir videoyu yeniden üretmek için: YouTube'a zamanlanmış (henüz yayınlanmamış) yüklemeyi siler,
// Firestore kaydını sıfırlar ve senaryoyu done/'dan queue/'ya geri alır. Sonraki üretim onu baştan render eder
// (karakter sesleri ElevenLabs önbelleğinden gelir, yeniden kredi harcanmaz).
// Güvenlik: video herkese açıksa ya da yayın saati geçmişse hiçbir şey yapmaz.
// Kullanım (bilgisayarda): node src/yeniden-uret.js <jobId>   → sonra queue/ değişikliğini commit edip üretimi başlat.
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { db } from './lib/firebase.js';
import { DONE_DIR, QUEUE_DIR, SECRETS_DIR } from './lib/paths.js';
import { authFor } from './pipeline/youtube.js';

// Bilgisayarda OAuth istemci bilgileri ortam değişkeninde değilse secrets/ dosyalarından okunur.
for (const [dosya, id, sir] of [['oauth-client.json', 'YT_CLIENT_ID', 'YT_CLIENT_SECRET'], ['tv-client.json', 'YT_TV_CLIENT_ID', 'YT_TV_CLIENT_SECRET']]) {
  const f = path.join(SECRETS_DIR, dosya);
  if (!process.env[id] && fs.existsSync(f)) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8')).installed;
    process.env[id] = c.client_id; process.env[sir] = c.client_secret;
  }
}

const jobId = process.argv[2];
if (!jobId) throw new Error('Kullanım: node src/yeniden-uret.js <jobId>');
const doneFile = path.join(DONE_DIR, `${jobId}.json`);
if (!fs.existsSync(doneFile)) throw new Error(`done/${jobId}.json yok (video henüz üretilmemiş ya da zaten kuyrukta)`);
const firestore = db();
const ref = firestore.doc(`videos/${jobId}`);
const v = (await ref.get()).data();
if (!v?.youtubeId) throw new Error('Firestore kaydında youtubeId yok');
const publishAt = v.publishAt?.toDate?.() ?? new Date(JSON.parse(fs.readFileSync(doneFile, 'utf8')).publishAt);
if (publishAt.getTime() <= Date.now()) throw new Error(`Yayın saati geçmiş (${publishAt.toISOString()}): yayındaki videoya dokunulmaz`);

const yt = google.youtube({ version: 'v3', auth: authFor((await firestore.doc(`secrets/${v.channelId}`).get()).data()) });
const item = (await yt.videos.list({ part: ['status', 'snippet'], id: [v.youtubeId] })).data.items?.[0];
if (item) {
  if (item.status.privacyStatus === 'public') throw new Error('Video herkese açık: silinmedi');
  console.log(`Siliniyor: ${v.youtubeId} — ${item.snippet.title} (${item.status.privacyStatus}, yayın ${item.status.publishAt})`);
  await yt.videos.delete({ id: v.youtubeId });
} else {
  console.log(`YouTube'da ${v.youtubeId} bulunamadı (zaten silinmiş); kayıt sıfırlanıyor.`);
}
await ref.set({
  status: 'queued', youtubeId: null, url: null, scheduled: null, attempts: 0, retry: true, error: null,
  yenidenUretim: { eskiYoutubeId: v.youtubeId, tarih: new Date() }, updatedAt: new Date(),
}, { merge: true });
fs.renameSync(doneFile, path.join(QUEUE_DIR, `${jobId}.json`));
console.log(`✓ ${jobId} kuyruğa geri alındı. Commit edip üretimi başlat.`);
process.exit(0);
