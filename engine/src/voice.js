// Kanalın klon ses örneğini yönetir. Örnek GitHub'a değil, Firestore'a (voices/<kanal>) konur.
//   node src/voice.js yukle <kanalId> <dosya.mp3>   → bilgisayardan Firestore'a
//   node src/voice.js indir <kanalId> <hedef.mp3>   → Firestore'dan dosyaya (GitHub Actions)
import fs from 'node:fs';
import { db } from './lib/firebase.js';

const MAX_BYTES = 700_000; // Firestore belge sınırı 1 MB; base64 ~%33 büyütür.

const [cmd, channelId, file] = process.argv.slice(2);
if (!['yukle', 'indir'].includes(cmd) || !channelId || !file) {
  console.error('Kullanım: node src/voice.js yukle|indir <kanalId> <dosya>');
  process.exit(1);
}

const ref = db().doc(`voices/${channelId}`);
if (cmd === 'yukle') {
  const buf = fs.readFileSync(file);
  if (buf.length > MAX_BYTES) {
    console.error(`Dosya çok büyük (${Math.round(buf.length / 1024)} KB). 30 saniyeden kısa, mono mp3 olmalı.`);
    process.exit(1);
  }
  await ref.set({ audio: buf.toString('base64'), bytes: buf.length, updatedAt: new Date() });
  console.log(`✓ Ses örneği yüklendi (${Math.round(buf.length / 1024)} KB).`);
} else {
  const data = (await ref.get()).data();
  if (!data?.audio) {
    console.error(`${channelId} için ses örneği yok.`);
    process.exit(1);
  }
  fs.writeFileSync(file, Buffer.from(data.audio, 'base64'));
  console.log(`✓ Ses örneği indirildi (${Math.round(data.bytes / 1024)} KB).`);
}
process.exit(0);
