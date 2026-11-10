// Bir YouTube kanalına TikTok hesabı bağlar (bilgisayardan bir kez çalıştırılır).
// Kullanım: node src/connect-tiktok.js <youtubeKanalId> [taslak|direkt]
// Gerekenler: secrets/tiktok.json { clientKey, clientSecret, redirectUri } ve secrets/service-account.json
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { db } from './lib/firebase.js';
import { SECRETS_DIR } from './lib/paths.js';
import { tokenAl, ttKullanici } from './pipeline/tiktok.js';

const [kanalId, mod = 'taslak'] = process.argv.slice(2);
if (!kanalId) throw new Error('Kullanım: node src/connect-tiktok.js <youtubeKanalId> [taslak|direkt]');
const app = JSON.parse(fs.readFileSync(path.join(SECRETS_DIR, 'tiktok.json'), 'utf8'));
const redirect = new URL(app.redirectUri);

// PKCE (masaüstü uygulamalarında TikTok, SHA-256 özetini onaltılık bekler)
const verifier = crypto.randomBytes(48).toString('base64url').slice(0, 64);
const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
const state = crypto.randomBytes(12).toString('hex');
const url = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
  client_key: app.clientKey, scope: 'user.info.basic,user.info.stats,video.list,video.upload,video.publish', response_type: 'code',
  redirect_uri: app.redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256',
})}`;

const kod = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, app.redirectUri);
    if (u.pathname !== redirect.pathname) { res.end(); return; }
    const hata = u.searchParams.get('error_description') || u.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(hata ? `<h2>TikTok bağlanamadı: ${hata}</h2>` : '<h2>TikTok bağlandı. Bu pencereyi kapatabilirsin.</h2>');
    server.close();
    if (hata) reject(new Error(hata));
    else if (u.searchParams.get('state') !== state) reject(new Error('state uyuşmuyor'));
    else resolve(u.searchParams.get('code'));
  });
  server.listen(Number(redirect.port), redirect.hostname, () => {
    console.log(`Tarayıcı açılıyor. Açılmazsa bu adresi kopyala:\n${url}\n`);
    spawn('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')], { stdio: 'ignore', detached: true }).on('error', () => {});
  });
});

const tt = await tokenAl(app, { code: kod, grant_type: 'authorization_code', redirect_uri: app.redirectUri, code_verifier: verifier });
const kullanici = await ttKullanici(tt).catch(() => ({}));
const firestore = db();
await firestore.doc('secrets/tiktok_app').set({ clientKey: app.clientKey, clientSecret: app.clientSecret, updatedAt: new Date() });
await firestore.doc(`secrets/tt_${kanalId}`).set({ ...tt, kullanici: kullanici.username ?? kullanici.display_name ?? null, updatedAt: new Date() });
await firestore.doc(`channels/${kanalId}`).set({ settings: { tiktok: { enabled: true, mod, kullanici: kullanici.username ?? null } }, tiktokHata: null }, { merge: true });
console.log(`✓ TikTok "${kullanici.display_name ?? kullanici.username ?? tt.openId}" bağlandı (izinler: ${tt.scope}). Mod: ${mod}.`);
process.exit(0);
