// Kanalın klon ses örneği Firestore'da (voices/<kanal>) durur; GitHub'a hiç konmaz.
import fs from 'node:fs';
import { db } from './firebase.js';

export const MAX_SAMPLE_BYTES = 700_000; // Firestore belge sınırı 1 MB; base64 ~%33 büyütür.

export async function uploadVoiceSample(channelId, file) {
  const buf = fs.readFileSync(file);
  if (buf.length > MAX_SAMPLE_BYTES) {
    throw new Error(`Dosya çok büyük (${Math.round(buf.length / 1024)} KB). 30 saniyeden kısa, mono mp3 olmalı.`);
  }
  await db().doc(`voices/${channelId}`).set({ audio: buf.toString('base64'), bytes: buf.length, updatedAt: new Date() });
  // Uygulama örneğin kendisini göremez, sadece yüklü olduğunu bilir.
  await db().doc(`channels/${channelId}`).set({ hasVoiceSample: true }, { merge: true });
  return buf.length;
}

export async function downloadVoiceSample(channelId, dest) {
  const data = (await db().doc(`voices/${channelId}`).get()).data();
  if (!data?.audio) throw new Error('Bu kanal için ses örneği yüklenmemiş');
  fs.writeFileSync(dest, Buffer.from(data.audio, 'base64'));
  return dest;
}
