import { db } from './firebase.js';

// Uygulamadaki olay akışına kayıt düşer ve kayıtlı telefonlara Expo üzerinden bildirim yollar.
export async function notify({ level = 'info', title, body, channelId = null, videoId = null }) {
  const firestore = db();
  await firestore.collection('events').add({ level, title, body, channelId, videoId, createdAt: new Date() });

  const devices = await firestore.collection('devices').get();
  const messages = devices.docs
    .map((d) => d.data().expoPushToken)
    .filter(Boolean)
    .map((to) => ({ to, title, body, sound: 'default', data: { channelId, videoId } }));
  if (!messages.length) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.warn(`Bildirim gönderilemedi: ${e.message}`);
  }
}
