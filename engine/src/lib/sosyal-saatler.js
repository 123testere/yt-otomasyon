// Instagram/TikTok'ta paylaşılmayı bekleyen videoların yayın saatleri → config/sosyal-saatler.json.
// Google Apps Script zamanlayıcısı (araclar/zamanlayici.gs) bu dosyayı 5 dakikada bir okur ve saati gelince
// "Instagram Reels paylaş" iş akışını başlatır (GitHub'ın kendi zamanlayıcısı saatlerce gecikebiliyor).
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.js';

export async function saatleriYaz(firestore, now = new Date()) {
  const saatler = new Set();
  for (const alan of ['instagram', 'tiktok']) {
    const snap = await firestore.collection('videos').where(`${alan}.durum`, '==', 'bekliyor').get();
    for (const d of snap.docs) {
      const t = d.data()[alan]?.yayin?.toDate?.();
      if (t && t.getTime() > now.getTime() - 6 * 3600 * 1000) saatler.add(t.toISOString());
    }
  }
  const icerik = `${JSON.stringify({ saatler: [...saatler].sort() }, null, 2)}\n`;
  const dosya = path.join(CONFIG_DIR, 'sosyal-saatler.json');
  if (fs.existsSync(dosya) && fs.readFileSync(dosya, 'utf8') === icerik) return false;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(dosya, icerik);
  return true;
}
