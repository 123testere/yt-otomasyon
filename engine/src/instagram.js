// Instagram iş akışı: yayın saati gelmiş Reels'leri paylaşır ve bağlantıyı yoklar (YouTube'a dokunmaz, hızlı).
// Bir paylaşım geçici bir hatayla kalırsa aynı çalışmada 3'er dakika arayla 2 kez daha denenir
// (bir sonraki zamanlanmış çalışmayı beklemek saatler sürebiliyor).
import { db } from './lib/firebase.js';
import { publishDueReels, publishDueTiktok } from './lib/instagram-queue.js';

const f = db();
const bekleyenVar = async () => {
  const now = Date.now();
  for (const alan of ['instagram', 'tiktok']) {
    const snap = await f.collection('videos').where(`${alan}.durum`, '==', 'bekliyor').get();
    if (snap.docs.some((d) => d.data()[alan].yayin.toMillis() <= now)) return true;
  }
  return false;
};

for (let tur = 1; tur <= 3; tur++) {
  await publishDueReels(f, new Date()).catch((e) => console.warn(`Instagram: ${e.message}`));
  await publishDueTiktok(f, new Date()).catch((e) => console.warn(`TikTok: ${e.message}`));
  if (tur === 3 || !(await bekleyenVar())) break;
  console.log(`Saati gelmiş paylaşım hâlâ bekliyor; 3 dakika sonra yeniden denenecek (${tur}/2).`);
  await new Promise((r) => setTimeout(r, 180_000));
}
process.exit(0);
