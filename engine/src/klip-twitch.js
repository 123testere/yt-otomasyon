// Klip kampanyaları (config/kampanyalar.json) için Twitch'te en çok izlenen klipleri bulur ve
// Vice City Dispatch kuyruğuna kesit işi yazar. İzleyicilerin kesip en çok izlediği klip = patlayan an.
// Twitch resmi API anahtarı (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET) varsa oyun filtresi (GTA 6) uygulanır;
// yoksa yt-dlp ile kanalın klip sayfası okunur (oyun filtresi yok, başlıkta GTA aranır).
// Kullanım: node src/klip-twitch.js [--kuru]   (--kuru: kuyruğa yazmadan listeler)
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { kampanyalar, olumsuzMu, yayinBasligiMi } from './lib/kampanya.js';
import { DONE_DIR, QUEUE_DIR, ROOT } from './lib/paths.js';

const sh = promisify(execFile);
const YTDLP = process.env.YTDLP ?? 'yt-dlp';
const KANAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'kampanyalar.json'), 'utf8')).kanal ?? 'UCaTfPvQYowD7SrHbGfotRrg';
const KURU = process.argv.includes('--kuru');
const ONIZLEME = process.argv.includes('--onizleme') ? process.argv[process.argv.indexOf('--onizleme') + 1] : null;
const FAILED_DIR = path.join(ROOT, 'failed');

// ---- Twitch resmi API (Helix) ----
let token = null;
async function helix(yol) {
  if (!token) {
    const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    token = (await r.json()).access_token;
    if (!token) throw new Error('Twitch anahtarı geçersiz');
  }
  const r = await fetch(`https://api.twitch.tv/helix/${yol}`, { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Twitch API ${r.status}: ${yol}`);
  return (await r.json()).data ?? [];
}

async function helixKlipler(k) {
  const [user] = await helix(`users?login=${k.twitch}`);
  const [oyun] = k.oyun ? await helix(`games?name=${encodeURIComponent(k.oyun)}`) : [];
  const bas = new Date(Math.max(Date.parse(k.baslangic), Date.now() - 7 * 864e5)).toISOString();
  const liste = await helix(`clips?broadcaster_id=${user.id}&started_at=${bas}&ended_at=${new Date().toISOString()}&first=100`);
  return liste
    .filter((c) => !oyun || c.game_id === oyun.id)
    .map((c) => ({ id: c.id, url: c.url, baslik: c.title, izlenme: c.view_count, tarih: c.created_at, sure: c.duration }));
}

// ---- yt-dlp ile (anahtarsız) ----
async function ytdlpKlipler(k) {
  const { stdout } = await sh(YTDLP, ['-J', '--no-warnings', '--playlist-end', '40', `https://www.twitch.tv/${k.twitch}/clips?filter=clips&range=7d`], { maxBuffer: 256 * 1024 * 1024 });
  const bas = Date.parse(k.baslangic);
  return (JSON.parse(stdout).entries ?? [])
    .filter((c) => !c.timestamp || c.timestamp * 1000 >= bas)
    .filter((c) => !k.oyun || /gta|grand theft|vi\b|6/i.test(c.title ?? ''))
    .map((c) => ({ id: c.id, url: c.webpage_url ?? c.url, baslik: c.title, izlenme: c.view_count ?? 0, tarih: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null, sure: c.duration }));
}

// Daha önce kullanılan klipler ve bugün bu kampanyaya yazılan iş sayısı
function kullanilanlar() {
  const out = [];
  for (const d of [QUEUE_DIR, DONE_DIR, FAILED_DIR]) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.includes('_kesit-'))) {
      try { out.push(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))); } catch { /* bozuk */ }
    }
  }
  return out;
}

const temizle = (s) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

export function isOlustur(k, c, simdi = new Date()) {
  const gun = simdi.toISOString().slice(0, 10);
  const ad = k.zorunluAd;
  let hook = temizle(c.baslik).toUpperCase();
  if (!hook.toLowerCase().includes(ad.toLowerCase())) hook = `${ad.toUpperCase()}: ${hook}`;
  if (hook.length > 70) hook = hook.slice(0, 67).replace(/\s+\S*$/, '') + '…';
  const kisa = temizle(c.baslik).slice(0, 60);
  let title = `${kisa} | ${ad} GTA 6`;
  if (!kisa.toLowerCase().includes(ad.toLowerCase())) title = `${ad}: ${kisa} 😂 #GTA6`;
  const id = `${gun}_${KANAL}_kesit-${k.id}-${String(c.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
  return {
    id, channelId: KANAL, type: 'short', format: 'kesit', kampanya: k.id,
    publishAt: new Date(simdi.getTime() + 60_000).toISOString(), // üretilir üretilmez yayın; 30 dk içinde Whop'a gönderilir
    topic: `${ad} GTA 6 maratonu: ${kisa}`,
    title: title.slice(0, 100),
    description: `${ad} — ${kisa}\nFrom ${ad}'s GTA 6 marathon on Twitch: twitch.tv/${k.twitch}\n\n${k.etiketler.join(' ')}`,
    tags: [ad, `${ad} gta 6`, `${ad} clips`, 'gta 6', 'gta 6 marathon', 'gta vi'],
    hook,
    kredi: `${ad} · twitch.tv/${k.twitch}`,
    kaynak: { url: c.url, platform: 'Twitch', yayinci: ad, klipId: c.id, izlenme: c.izlenme, tarih: c.tarih },
  };
}

async function main() {
  const eski = kullanilanlar();
  const kullanilan = new Set(eski.map((j) => j.kaynak?.klipId));
  const bugun = new Date().toISOString().slice(0, 10);
  const anahtar = Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  let yazilan = 0;
  for (const k of kampanyalar().filter((x) => x.aktif)) {
    try {
      const klipler = (anahtar ? await helixKlipler(k) : await ytdlpKlipler(k))
        .filter((c) => !kullanilan.has(c.id) && !olumsuzMu(c.baslik) && !yayinBasligiMi(c.baslik) && (c.sure ?? 30) >= 6)
        .sort((a, b) => b.izlenme - a.izlenme);
      const kalan = ONIZLEME ? 1 : Math.max(0, (k.gunluk ?? 3) - eski.filter((j) => j.kampanya === k.id && j.id.startsWith(bugun)).length);
      console.log(`${k.ad}: ${klipler.length} aday${anahtar ? '' : ' (anahtarsız)'}, bugün ${kalan} hak`);
      for (const c of klipler.slice(0, kalan)) {
        const job = isOlustur(k, c);
        console.log(`  + ${c.izlenme} izlenme  ${c.baslik}`);
        if (!KURU) { const hedef = ONIZLEME ?? QUEUE_DIR; fs.mkdirSync(hedef, { recursive: true }); fs.writeFileSync(path.join(hedef, `${job.id}.json`), JSON.stringify(job, null, 2)); yazilan++; }
      }
    } catch (e) {
      console.error(`✗ ${k.ad}: ${e.stderr?.toString().trim().split('\n').at(-1) ?? e.message}`);
    }
  }
  console.log(`✓ ${yazilan} iş kuyruğa yazıldı`);
}

if (process.argv[1]?.endsWith('klip-twitch.js')) main();
