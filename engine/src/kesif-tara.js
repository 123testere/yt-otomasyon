// Haftalık keşif taraması (iş akışı: .github/workflows/kesif.yml).
// config/kesif.json + kesif.jpg yazar; uygulama için Firestore kesif/<kanalId> (aday verisi; durum alanlarına dokunmaz).
import fs from 'node:fs';
import { db } from './lib/firebase.js';
import { authFor } from './pipeline/youtube.js';
import { KESIF_JSON, kesifPanosu, kesifTara } from './lib/kesif.js';

const firestore = db();
const bizim = (await firestore.collection('channels').get()).docs.map((d) => d.id);
const onceki = (await firestore.collection('kesif').get()).docs;
const reddedilen = onceki.filter((d) => ['reddedildi', 'baslatildi'].includes(d.data().durum)).map((d) => d.id);
// Herhangi bir bağlı kanalın izniyle (sadece herkese açık veri okunur)
let secret = null;
for (const id of bizim) {
  secret = (await firestore.doc(`secrets/${id}`).get()).data();
  if (secret?.refreshToken) break;
}
const sonuc = await kesifTara({ auth: authFor(secret), haric: bizim, reddedilen });
fs.writeFileSync(KESIF_JSON, `${JSON.stringify(sonuc, null, 2)}\n`);
await kesifPanosu(sonuc).catch((e) => console.warn(`kesif panosu: ${e.message}`));
for (const a of sonuc.adaylar) {
  await firestore.doc(`kesif/${a.id}`).set({ aday: a, taramaAt: new Date(sonuc.guncellendi) }, { merge: true });
}
console.log(`${sonuc.adaylar.length} aday:`);
for (const a of sonuc.adaylar) console.log(` ${a.sira}. ${a.ad} [${a.dil}] ${a.yasGun} gün, ${a.abone} abone, günde ~${a.gunlukIzlenme} izlenme | ${a.enIyi[0]?.baslik?.slice(0, 50)}`);
process.exit(0);
