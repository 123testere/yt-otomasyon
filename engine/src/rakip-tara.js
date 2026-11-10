// Haftalık rakip taraması (iş akışı: .github/workflows/rakip.yml). İsteğe bağlı: node src/rakip-tara.js <kanalId>
// Her kanal için config/rakipler/<kanal>.json + .jpg yazar ve uygulama için Firestore rakip/<kanal> özetini günceller.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './lib/firebase.js';
import { authFor } from './pipeline/youtube.js';
import { RAKIP_DIR, kapakPanosu, rakipAyarlari, rakipTara } from './lib/rakip.js';

const firestore = db();
const ayarlar = rakipAyarlari();
const sadece = process.argv[2];
fs.mkdirSync(RAKIP_DIR, { recursive: true });

for (const [kanalId, ayar] of Object.entries(ayarlar)) {
  if (kanalId.startsWith('_') || (sadece && kanalId !== sadece)) continue;
  const ch = (await firestore.doc(`channels/${kanalId}`).get()).data();
  if (!ch?.settings?.enabled) continue;
  const secret = (await firestore.doc(`secrets/${kanalId}`).get()).data();
  if (!secret?.refreshToken) continue;
  console.log(`▶ ${ch.title}`);
  try {
    const elle = [...new Set([...(ayar.elle ?? []), ...(ch.rakipler ?? [])])];
    const r = await rakipTara({ auth: authFor(secret), kanalId, ayar, elle });
    if (!r) { console.log('  rakip bulunamadı'); continue; }
    fs.writeFileSync(path.join(RAKIP_DIR, `${kanalId}.json`), `${JSON.stringify(r, null, 2)}\n`);
    const pano = await kapakPanosu(r.patlayanlar, path.join(RAKIP_DIR, `${kanalId}.jpg`)).catch((e) => { console.warn(`  kapak panosu: ${e.message}`); return null; });
    await firestore.doc(`rakip/${kanalId}`).set({
      guncellendi: new Date(r.guncellendi),
      rakipler: r.rakipler.map(({ yayinSaatleri, ...k }) => k),
      patlayanlar: r.patlayanlar.map(({ aciklama, etiketler, ...p }) => p),
      saatDagilimi: r.saatDagilimi,
    }, { merge: true });
    console.log(`  ${r.rakipler.length} rakip, ${r.patlayanlar.length} patlayan video${pano ? ', kapak panosu hazır' : ''}`);
    for (const k of r.rakipler) console.log(`   - ${k.ad} (${k.abone} abone, medyan ${k.medyanIzlenme})`);
  } catch (e) {
    console.warn(`  ✗ ${e.message}`);
  }
}
process.exit(0);
