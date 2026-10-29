// Bir YouTube kanalını sisteme bağlar (her kanal için bilgisayarda bir kez çalıştırılır).
// Tarayıcıda Google girişi açılır; hesap seçerken bağlamak istediğin KANALI seç.
// Gerekenler: secrets/oauth-client.json (Masaüstü uygulaması OAuth istemcisi) ve secrets/service-account.json
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { google } from 'googleapis';
import { db } from './lib/firebase.js';
import { options } from './lib/options.js';
import { SECRETS_DIR } from './lib/paths.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

function loadClient() {
  const file = path.join(SECRETS_DIR, 'oauth-client.json');
  if (!fs.existsSync(file)) throw new Error('secrets/oauth-client.json bulunamadı (README → Adım 3).');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = raw.installed ?? raw.web;
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
}

function waitForCode(server) {
  return new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (!code && !error) return res.end();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(code ? '<h2>Kanal bağlandı. Bu pencereyi kapatabilirsin.</h2>' : `<h2>Hata: ${error}</h2>`);
      code ? resolve(code) : reject(new Error(error));
    });
  });
}

async function main() {
  const { clientId, clientSecret } = loadClient();
  const server = http.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const redirectUri = `http://127.0.0.1:${server.address().port}`;
  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  console.log('Tarayıcı açılıyor. Açılmazsa bu adresi kopyala:\n' + authUrl + '\n');
  openBrowser(authUrl);

  const code = await waitForCode(server);
  server.close();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) throw new Error('Kalıcı izin (refresh token) gelmedi. Google hesabından uygulama erişimini kaldırıp tekrar dene.');
  oauth.setCredentials(tokens);

  const yt = google.youtube({ version: 'v3', auth: oauth });
  const { data } = await yt.channels.list({ part: ['snippet'], mine: true });
  const channel = data.items?.[0];
  if (!channel) throw new Error('Bu hesapta YouTube kanalı bulunamadı.');

  const firestore = db();
  const ref = firestore.doc(`channels/${channel.id}`);
  const existing = await ref.get();
  await ref.set({
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url ?? null,
    connectedAt: new Date(),
    needsReconnect: false,
    ...(existing.exists ? {} : { settings: options.defaults }),
  }, { merge: true });
  await firestore.doc(`secrets/${channel.id}`).set({ refreshToken: tokens.refresh_token, updatedAt: new Date() });

  console.log(`✓ "${channel.snippet.title}" (${channel.id}) bağlandı. Ayarlarını uygulamadan yapabilirsin.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
