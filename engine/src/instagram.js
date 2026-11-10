// Instagram iş akışı: yayın saati gelmiş Reels'leri paylaşır ve bağlantıyı yoklar (YouTube'a dokunmaz, hızlı).
import { db } from './lib/firebase.js';
import { publishDueReels, publishDueTiktok } from './lib/instagram-queue.js';

const f = db();
await publishDueReels(f, new Date()).catch((e) => console.warn(`Instagram: ${e.message}`));
await publishDueTiktok(f, new Date()).catch((e) => console.warn(`TikTok: ${e.message}`));
