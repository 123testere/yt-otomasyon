// Yayın videosundan en iyi kesit adaylarını bulur (Vice City Dispatch).
// Sinyaller: ses yüksekliği (ffmpeg), sohbet tekrarı (live_chat), "en çok tekrar izlenen" ısı haritası, yorum zaman damgaları.
// Kullanım: node src/klip-bul.js <youtube-url> [adet=3]
// Gerekenler: yt-dlp (YTDLP ortam değişkeni ya da PATH) ve ffmpeg.
// Çıktı: analiz/klip-adaylari/<videoId>.json — rutin bunlardan Shorts senaryosu yazar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { enIyiKesitler } from './lib/klip-tespit.js';

const sh = promisify(execFile);
const YTDLP = process.env.YTDLP ?? 'yt-dlp';
const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');

async function ytdlp(args, cwd) {
  const { stdout } = await sh(YTDLP, ['--no-warnings', '--no-progress', ...args], { cwd, maxBuffer: 512 * 1024 * 1024 });
  return stdout;
}

// live_chat.json (satır başına bir JSON) → [{t, metin}]
export function sohbetOku(dosya) {
  if (!fs.existsSync(dosya)) return [];
  const out = [];
  for (const satir of fs.readFileSync(dosya, 'utf8').split('\n')) {
    if (!satir.trim()) continue;
    try {
      const r = JSON.parse(satir).replayChatItemAction;
      const t = Number(r?.videoOffsetTimeMsec) / 1000;
      const item = r?.actions?.[0]?.addChatItemAction?.item;
      const msg = item?.liveChatTextMessageRenderer ?? item?.liveChatPaidMessageRenderer;
      if (!msg || !Number.isFinite(t)) continue;
      const metin = (msg.message?.runs ?? []).map((x) => x.text ?? x.emoji?.shortcuts?.[0] ?? '').join('');
      out.push({ t, metin });
    } catch { /* bozuk satır */ }
  }
  return out;
}

// WAV (pcm_s16le, mono) → saniyelik RMS
function rmsOku(wav, hz) {
  const b = fs.readFileSync(wav);
  let o = 12;
  while (o < b.length - 8 && b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  o += 8;
  const n = Math.floor((b.length - o) / 2);
  const out = [];
  for (let s = 0; s + hz <= n; s += hz) {
    let t = 0;
    for (let i = s; i < s + hz; i++) { const v = b.readInt16LE(o + i * 2) / 32768; t += v * v; }
    out.push(Math.sqrt(t / hz));
  }
  return out;
}

async function main() {
  const [url, adetArg] = process.argv.slice(2);
  if (!url) throw new Error('kullanım: node src/klip-bul.js <youtube-url> [adet]');
  const adet = Number(adetArg ?? 3);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klip-'));

  console.log('▶ bilgi + yorumlar…');
  const bilgi = JSON.parse(await ytdlp(['-J', '--write-comments', '--extractor-args', 'youtube:max_comments=400,all,0;comment_sort=top', url], dir));
  console.log(`  ${bilgi.title} — ${bilgi.channel} (${Math.round(bilgi.duration / 60)} dk, ${bilgi.view_count} izlenme, ${bilgi.comment_count} yorum)`);

  console.log('▶ sohbet tekrarı…');
  await ytdlp(['--skip-download', '--write-subs', '--sub-langs', 'live_chat', '-o', 'v', url], dir).catch(() => console.log('  sohbet yok'));
  const mesajlar = sohbetOku(path.join(dir, 'v.live_chat.json'));

  console.log('▶ ses…');
  await ytdlp(['-f', 'bestaudio', '-o', 'ses.%(ext)s', url], dir);
  const ses = fs.readdirSync(dir).find((f) => f.startsWith('ses.'));
  const HZ = 8000;
  await sh('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, ses), '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', path.join(dir, 'ses.wav')]);
  const rms = rmsOku(path.join(dir, 'ses.wav'), HZ);

  const yorumlar = (bilgi.comments ?? []).map((c) => ({ metin: c.text, begeni: c.like_count ?? 0 }));
  const kesitler = enIyiKesitler({ rms, mesajlar, harita: bilgi.heatmap ?? [], yorumlar, sure: bilgi.duration }, adet);

  const sonuc = {
    video: { id: bilgi.id, url: bilgi.webpage_url, baslik: bilgi.title, kanal: bilgi.channel, kanalId: bilgi.channel_id, sure: bilgi.duration, izlenme: bilgi.view_count, yorum: bilgi.comment_count },
    sinyal: { sohbet: mesajlar.length, harita: (bilgi.heatmap ?? []).length, yorum: yorumlar.length, sesSn: rms.length },
    kesitler: kesitler.map((k) => ({
      ...k,
      // o andaki sohbet ve yorumlar: rutin "neden patladı" anlatımını bunlardan yazar
      sohbetOrnek: mesajlar.filter((m) => m.t >= k.kesit.bas && m.t <= k.kesit.son).slice(0, 25).map((m) => m.metin),
      yorumOrnek: (bilgi.comments ?? []).filter((c) => /\d:\d\d/.test(c.text)).filter((c) => {
        const t = c.text.match(/(?:(\d+):)?(\d+):(\d\d)/);
        const sn = t ? Number(t[1] ?? 0) * 3600 + Number(t[2]) * 60 + Number(t[3]) : -1;
        return sn >= k.kesit.bas - 10 && sn <= k.kesit.son + 10;
      }).slice(0, 8).map((c) => c.text.slice(0, 200)),
    })),
    tarih: new Date().toISOString(),
  };
  const hedefDir = path.join(KOK, 'analiz', 'klip-adaylari');
  fs.mkdirSync(hedefDir, { recursive: true });
  fs.writeFileSync(path.join(hedefDir, `${bilgi.id}.json`), JSON.stringify(sonuc, null, 2));
  for (const k of sonuc.kesitler) console.log(`  ★ ${k.puan}  ${k.kesit.bas}-${k.kesit.son} sn  [${Object.keys(k.sinyaller).join('+')}]`);
  console.log(`✓ analiz/klip-adaylari/${bilgi.id}.json`);
  fs.rmSync(dir, { recursive: true, force: true });
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => { console.error('✗ ' + (e.stderr?.toString().trim().split('\n').at(-1) ?? e.message)); process.exit(1); });
}
