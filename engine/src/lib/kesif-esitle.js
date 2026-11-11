// Keşif akışının senkronizasyon tarafı:
//  1) analiz/kesif.json (Claude'un fırsat değerlendirmesi) → Firestore kesif/<id>.firsat
//  2) Uygulamada "Örnek yap" denenler → config/kesif-istekler.json (gece rutini pilot senaryoyu yazar)
//  3) "Kanalı başlat" ile bağlanan yeni kanal (channels/<id>.kesifKaynak) → ayarlar + kimlik kurulumu otomatik
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, ROOT } from './paths.js';
import { notify } from './notify.js';

const okuJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export async function kesifEsitle(firestore, now = new Date()) {
  const analiz = okuJson(path.join(ROOT, 'analiz', 'kesif.json'));
  if (analiz?.firsatlar) {
    for (const f of analiz.firsatlar) {
      const ref = firestore.doc(`kesif/${f.kanalId}`);
      const v = (await ref.get()).data();
      if (v?.firsatKaynak !== analiz.kaynak || !v?.firsat) await ref.set({ firsat: f, firsatKaynak: analiz.kaynak, firsatAt: now }, { merge: true });
    }
  }

  const docs = (await firestore.collection('kesif').get()).docs;
  const istekler = docs.filter((d) => d.data().durum === 'ornek-istendi').map((d) => ({
    id: d.id, ad: d.data().aday?.ad ?? null, firsat: d.data().firsat ?? null, not: d.data().istekNot ?? null,
    tekrar: Boolean(d.data().ornek), oncekiBaslik: d.data().ornek?.baslik ?? null,
  }));
  // "Tekrar dene": mevcut pilot Claude'u beklemeden yeniden üretilir (iş akışı kesif-ornek.yml'i tetikler)
  if (docs.some((d) => d.data().durum === 'ornek-tekrar') && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'kesif=1\n');
  const dosya = path.join(CONFIG_DIR, 'kesif-istekler.json');
  const icerik = `${JSON.stringify(istekler, null, 2)}\n`;
  if (!fs.existsSync(dosya) || fs.readFileSync(dosya, 'utf8') !== icerik) fs.writeFileSync(dosya, icerik);

  // Kanalı başlat: kullanıcı yeni kanalı bağlayıp keşif kaynağını işaretledi
  for (const ch of (await firestore.collection('channels').get()).docs) {
    const c = ch.data();
    if (!c.kesifKaynak || c.kesifKuruldu) continue;
    const k = (await firestore.doc(`kesif/${c.kesifKaynak}`).get()).data();
    const kimlik = k?.kimlik;
    if (!kimlik?.dizi || !fs.existsSync(path.join(ROOT, 'diziler', `${kimlik.dizi}.json`))) continue;
    const a = kimlik.ayarlar ?? {};
    await ch.ref.update({
      'settings.enabled': true, 'settings.contentFormat': 'dizi', 'settings.dizi': kimlik.dizi, 'settings.diziShorts': 'bagimsiz',
      'settings.language': a.language ?? k.firsat?.dil ?? 'tr', 'settings.niche': a.niche ?? 'animasyon',
      'settings.shorts': { times: a.shortsTimes ?? ['12:00'], seconds: 45, source: 'bagimsiz' },
      'settings.long': { days: a.longDays ?? [], time: a.longTime ?? '18:00', minutes: a.minutes ?? 8 },
      'settings.music': a.music ?? 'epik', 'settings.musicVolume': '0.06', 'settings.aiDisclosure': true, 'settings.privacy': 'public',
      'settings.hashtags': a.hashtags ?? '', 'settings.identityLocked': true,
      // Kanal kimliği (açıklama, anahtar kelimeler, banner, profil resmi) üretimde YouTube'a uygulanır (lib/setup.js)
      'settings.kurulum': {
        aciklama: kimlik.aciklama ?? '', anahtarKelimeler: (kimlik.etiketler ?? []).join(', '), slogan: kimlik.slogan ?? '',
        ulke: a.ulke ?? (a.language === 'tr' ? 'TR' : 'US'), banner: true, renkler: kimlik.renkler ?? null, anaKarakter: kimlik.anaKarakter ?? null,
        istek: Date.now(),
      },
      kesifKuruldu: now,
    });
    await firestore.doc(`kesif/${c.kesifKaynak}`).set({ durum: 'baslatildi', kanal: ch.id, baslatAt: now }, { merge: true });
    await notify({ title: 'Yeni kanal kuruldu', body: `${c.title}: format, takvim ve kanal kimliği otomatik ayarlandı; ilk videolar bu gece yazılır.`, channelId: ch.id });
    console.log(`Keşif: ${c.title} kanalı ${kimlik.dizi} formatıyla başlatıldı.`);
  }
}
