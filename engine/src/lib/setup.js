// Uygulamadaki kanal kurulum sihirbazı (settings.kurulum): açıklama, anahtar kelimeler, ülke, dil ve banner YouTube'a yazılır.
// YouTube API kanal adını ve profil fotoğrafını değiştirmeye izin vermez: profil fotoğrafı üretilip uygulamaya konur,
// kullanıcı YouTube'da kendisi yükler. Sonuç channels/{id}.kurulumSonuc alanına yazılır.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { authFor } from '../pipeline/youtube.js';
import { remotionStill } from '../pipeline/remotion.js';
import { options, pick, resolveSettings } from './options.js';
import { run } from './util.js';
import { ROOT } from './paths.js';

// YouTube anahtar kelimeleri boşlukla ayrılır; çok kelimeliler tırnak içinde olmalı.
const keywords = (text) => String(text ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  .map((k) => (/\s/.test(k) ? `"${k.replace(/"/g, '')}"` : k)).join(' ').slice(0, 480);

async function still(id, props, dir, name) {
  const png = await remotionStill(id, props, path.join(dir, `${name}.png`), `kurulum-${name}`);
  const jpg = path.join(dir, `${name}.jpg`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', jpg]);
  return jpg;
}

export async function applySetup(firestore, doc) {
  const data = doc.data();
  const kurulum = data.settings?.kurulum;
  if (!kurulum?.istek || kurulum.istek === data.kurulumSonuc?.istek) return false;
  const sonuc = (durum, mesaj, extra = {}) => doc.ref.update({ kurulumSonuc: { istek: kurulum.istek, durum, mesaj, at: new Date(), ...extra } });

  const secret = (await firestore.doc(`secrets/${doc.id}`).get()).data();
  if (secret?.client !== 'tv') {
    await sonuc('hata', 'Bu kanal bilgisayardan bağlandığı için kimliğini değiştirme izni yok. Uygulamadan "Yeniden bağla" yap, sonra tekrar kaydet.');
    return true;
  }
  const settings = resolveSettings(data.settings);
  const theme = pick(options.visualStyles, settings.visualStyle)?.theme ?? null;
  const accent = (pick(options.subtitleColors, settings.subtitleColor) ?? options.subtitleColors[1]).css;
  const brand = { title: data.title, tagline: kurulum.slogan ?? '', accent, theme };
  // Keşiften başlatılan kanal: dizinin ana karakteri ve renk paletiyle banner / profil resmi
  if (kurulum.renkler) Object.assign(brand, { renkler: kurulum.renkler, accent: kurulum.renkler[1] ?? accent, theme: null });
  if (settings.contentFormat === 'dizi' && settings.dizi) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'diziler', `${settings.dizi}.json`), 'utf8'));
      brand.karakter = d.karakterler[kurulum.anaKarakter] ?? Object.values(d.karakterler)[0];
    } catch { /* dizi dosyası yoksa yazılı kimlik */ }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurulum-'));
  const yt = google.youtube({ version: 'v3', auth: authFor(secret) });
  try {
    // channels.update bölümün tamamını değiştirir; mevcut değerlerle birleştirilir.
    const current = (await yt.channels.list({ part: ['brandingSettings'], id: [doc.id] })).data.items?.[0]?.brandingSettings ?? {};
    const branding = {
      ...current,
      channel: {
        ...(current.channel ?? {}),
        ...(kurulum.aciklama ? { description: String(kurulum.aciklama).slice(0, 1000) } : {}),
        ...(kurulum.anahtarKelimeler ? { keywords: keywords(kurulum.anahtarKelimeler) } : {}),
        ...(kurulum.ulke ? { country: kurulum.ulke } : {}),
        defaultLanguage: settings.language,
      },
    };
    if (kurulum.banner) {
      const banner = await still('Banner', brand, dir, 'banner');
      const up = await yt.channelBanners.insert({ media: { mimeType: 'image/jpeg', body: fs.createReadStream(banner) } });
      branding.image = { ...(current.image ?? {}), bannerExternalUrl: up.data.url };
    }
    await yt.channels.update({ part: ['brandingSettings'], requestBody: { id: doc.id, brandingSettings: branding } });
    const avatar = await still('Avatar', brand, dir, 'avatar');
    await sonuc('tamam', kurulum.banner ? 'Açıklama, anahtar kelimeler ve banner YouTube\'a yüklendi.' : 'Açıklama ve anahtar kelimeler YouTube\'a yazıldı.', {
      avatar: fs.readFileSync(avatar).toString('base64'),
    });
  } catch (e) {
    await sonuc('hata', `YouTube reddetti: ${e.message.slice(0, 300)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

// Bekleyen kurulumlar (üretim iş akışının başında çalışır; Remotion orada kurulu).
export async function applyPendingSetups(firestore) {
  const snap = await firestore.collection('channels').get();
  for (const doc of snap.docs) {
    await applySetup(firestore, doc).catch((e) => console.warn(`${doc.id} kanal kurulumu: ${e.message}`));
  }
}
