// Instagram iş akışı: yayın saati gelmiş Reels'leri paylaşır ve bağlantıyı yoklar (YouTube'a dokunmaz, hızlı).
import { db } from './lib/firebase.js';
import { publishDueReels } from './lib/instagram-queue.js';

await publishDueReels(db(), new Date());
