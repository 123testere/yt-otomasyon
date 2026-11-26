// Bir kanalı Facebook sayfasına bağlar (bilgisayarda bir kez):
//   node src/connect-facebook.js <youtubeKanalId> <Graph API Explorer'dan alınan kullanıcı token'ı> [sayfa adı]
// Token'da şu izinler olmalı: pages_show_list, pages_read_engagement, pages_manage_posts (+ business_management ise sayfa işletmedeyse).
// Kısa ömürlü token, uygulama sırrıyla süresize çevrilir; sayfanın token'ı Firestore secrets/fb_<kanal>'a yazılır.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './lib/firebase.js';
import { SECRETS_DIR } from './lib/paths.js';

const [kanal, kullaniciToken, sayfaAdi] = process.argv.slice(2);
if (!kanal || !kullaniciToken) { console.error('kullanım: node src/connect-facebook.js <kanalId> <token> [sayfa adı]'); process.exit(1); }
const API = 'https://graph.facebook.com/v23.0';
const al = async (yol, p) => { const r = await (await fetch(`${API}/${yol}?${new URLSearchParams(p)}`)).json(); if (r.error) throw new Error(r.error.message); return r; };

let token = kullaniciToken;
// Uygulama bilgisi varsa 60 günlük token'a çevir (ondan alınan sayfa token'ı süresizdir)
const appDosya = path.join(SECRETS_DIR, 'instagram.json'); // { appId, appSecret }: "yt" uygulaması
if (fs.existsSync(appDosya)) {
  const app = JSON.parse(fs.readFileSync(appDosya, 'utf8'));
  token = (await al('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: token })).access_token;
  console.log('token uzun ömürlüye çevrildi');
}
const izin = (await al('me/permissions', { access_token: token })).data.filter((x) => x.status === 'granted').map((x) => x.permission);
for (const p of ['pages_show_list', 'pages_manage_posts']) if (!izin.includes(p)) throw new Error(`Token'da "${p}" izni yok`);
const sayfalar = (await al('me/accounts', { fields: 'id,name,access_token,instagram_business_account', access_token: token })).data;
if (!sayfalar.length) throw new Error('Bu hesapta yönetilen Facebook sayfası görünmüyor (sayfa seçimi izin penceresinde yapılmamış olabilir)');
const ig = (await db().doc(`secrets/ig_${kanal}`).get()).data();
const sayfa = sayfalar.find((s) => sayfaAdi && s.name.toLowerCase().includes(sayfaAdi.toLowerCase()))
  ?? sayfalar.find((s) => ig?.userId && s.instagram_business_account?.id === ig.userId)
  ?? (sayfalar.length === 1 ? sayfalar[0] : null);
if (!sayfa) throw new Error(`Hangi sayfa? Sayfa adını da yaz: ${sayfalar.map((s) => s.name).join(', ')}`);
const f = db();
// Mevcut istatistik bilgisi (token, userToken) korunur; paylaşım için ayrı token yazılır
await f.doc(`secrets/fb_${kanal}`).set({ pageId: sayfa.id, pageName: sayfa.name, paylasToken: sayfa.access_token, paylasUpdatedAt: new Date() }, { merge: true });
await f.doc(`channels/${kanal}`).set({ settings: { facebook: { enabled: true, sayfa: sayfa.name } } }, { merge: true });
console.log(`✓ "${sayfa.name}" sayfası bağlandı; bu kanalın Shorts'ları Facebook Reels olarak da paylaşılacak.`);
process.exit(0);
