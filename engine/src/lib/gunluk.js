// Gün sonu değerlendirmesi: Claude rutini her gece her kanal için analiz/gunluk-<kanalId>.json yazar
// ({ tarih, ozet, videolar: [{ youtubeId, baslik, izlenme, hedef, neden, aksiyon }], yarin }).
// Senkronizasyon bunu uygulamaya (channels/{id}.optimizasyon.gunluk) aktarır ve günde bir bildirim yollar.
// Başlık/kapak değişiklikleri ayrı dosyadan (iyilestirme/*.json) uygulanır; bu dosya "ne gördük, ne yapıyoruz" kaydıdır.
import fs from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { ROOT } from './paths.js';
import { notify } from './notify.js';

const kisa = (v, n) => String(v ?? '').slice(0, n);
const liste = (v, adet, uzunluk) => (Array.isArray(v) ? v : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, adet).map((s) => kisa(s, uzunluk));

// Dosyadaki raporu Firestore'a uygun, sınırlı boyutta bir kayda çevirir. Geçersizse null.
export function gunlukKayit(rapor) {
  if (!rapor || typeof rapor !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(rapor.tarih ?? '')) return null;
  const ozet = liste(rapor.ozet, 5, 300);
  if (!ozet.length) return null;
  const sayi = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    tarih: rapor.tarih,
    ozet,
    videolar: (Array.isArray(rapor.videolar) ? rapor.videolar : []).filter((v) => v && typeof v === 'object').slice(0, 12).map((v) => ({
      youtubeId: kisa(v.youtubeId, 20), baslik: kisa(v.baslik, 100), izlenme: sayi(v.izlenme), hedef: sayi(v.hedef),
      neden: kisa(v.neden, 300), aksiyon: kisa(v.aksiyon, 300),
    })),
    yarin: liste(rapor.yarin, 5, 300),
  };
}

export async function gunlukEsitle(firestore, now = new Date()) {
  const dir = path.join(ROOT, 'analiz');
  let n = 0;
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => /^gunluk-.+\.json$/.test(x)) : []) {
    const channelId = f.slice(7, -5);
    try {
      const kayit = gunlukKayit(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
      if (!kayit) { console.warn(`günlük rapor ${f}: tarih (YYYY-MM-DD) ya da ozet eksik`); continue; }
      const ref = firestore.doc(`channels/${channelId}`);
      const data = (await ref.get()).data();
      if (!data || data.optimizasyon?.gunluk?.tarih === kayit.tarih) continue;
      await ref.update({
        'optimizasyon.gunluk': { ...kayit, at: now },
        'optimizasyon.degisiklikler': FieldValue.arrayUnion({ tarih: now.toISOString(), metin: `Gün sonu (${kayit.tarih}): ${kayit.ozet[0]}` }),
      });
      await notify({ title: `Gün sonu: ${data.title ?? channelId}`, body: [kayit.ozet[0], kayit.yarin[0] ? `Yarın: ${kayit.yarin[0]}` : null].filter(Boolean).join(' ').slice(0, 180), channelId });
      n++;
    } catch (e) {
      console.warn(`günlük rapor ${f}: ${e.message}`);
    }
  }
  return n;
}
