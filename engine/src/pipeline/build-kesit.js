// Yayın kesiti formatı (Vice City Dispatch): Twitch/Kick/YouTube yayınından izinli bir kesit alır,
// dikey Shorts kurgusu yapar: ortada yayın (arkada bulanık kopyası), üstte kanca yazısı, kısa İngilizce yorum
// ("neden patladı / nasıl kurgulandı") yayının sesini kısarak araya girer, altta yorum altyazısı ve yayıncı kredisi.
// Senaryo: { format:'kesit', type:'short', kaynak:{ url, platform, yayinci, bas, son, kampanya }, hook,
//            yorum:[{ sn, metin }], kapanis:{ metin } }
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { narrate } from './tts.js';
import { renderKesit } from './remotion.js';
import { probeDuration } from '../lib/util.js';
import { PY_DIR } from '../lib/paths.js';

const sh = promisify(execFile);
const YTDLP = process.env.YTDLP ?? 'yt-dlp';
export const KESIT_SURE = { min: 8, max: 58 };

// Kaynaktaki aralığı indirir (yalnız o bölüm; 1080p'yi geçmez)
export async function kesitIndir(kaynak, dir) {
  const out = path.join(dir, 'kaynak.mp4');
  if (fs.existsSync(kaynak.dosya ?? '')) { fs.copyFileSync(kaynak.dosya, out); return out; }
  const args = ['--no-warnings', '--no-progress', '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--merge-output-format', 'mp4', '-o', out];
  if (kaynak.bas != null && kaynak.son != null) args.push('--download-sections', `*${kaynak.bas}-${kaynak.son}`, '--force-keyframes-at-cuts');
  await sh(YTDLP, [...args, kaynak.url], { maxBuffer: 64 * 1024 * 1024 });
  return out;
}

export async function buildKesit(job, settings, { workDir }) {
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`  kesit: ${job.kaynak.yayinci} (${job.kaynak.platform}) ${job.kaynak.bas}-${job.kaynak.son} sn`);
  const video = await kesitIndir(job.kaynak, dir);
  const sure = Math.min(KESIT_SURE.max, await probeDuration(video));

  // Yorum satırları: her biri kendi sahnesi olarak seslendirilir (hız kuralı tts.js'te: Shorts en az +30%)
  const satirlar = [...(job.yorum ?? []), ...(job.kapanis?.metin ? [{ sn: null, metin: job.kapanis.metin, kapanis: true }] : [])];
  fs.mkdirSync(path.join(dir, 'ses'), { recursive: true });
  const ses = satirlar.length
    ? await narrate({ ...job, scenes: satirlar.map((s) => ({ narration: s.metin })) }, settings, path.join(dir, 'ses'))
    : { scenes: [] };
  // Satırları zamanına yerleştir: kapanış videonun sonuna, diğerleri verilen saniyeye (çakışırsa kaydırılır)
  let son = 0;
  const yorumlar = satirlar.map((s, i) => {
    const sc = ses.scenes[i];
    const d = sc.duration;
    let t0 = s.kapanis ? Math.max(son, sure - d - 0.2) : Math.max(son, Number(s.sn ?? 0));
    t0 = Math.min(t0, Math.max(0, sure - d));
    son = t0 + d + 0.15;
    return { t0, d, wav: sc.wav, kapanis: !!s.kapanis, words: (sc.words ?? []).map((w) => ({ t: w.t - sc.start + t0, d: w.d, text: w.text ?? w.w })) };
  });

  // Yorum yoksa (yapay zekâ sesi yasak kampanyalar): yayıncının kendi konuşması altyazı olur (Whisper, ücretsiz)
  let altyazi = [];
  if (!yorumlar.length && job.altyazi !== false) {
    try {
      const json = path.join(dir, 'konusma.json');
      await sh(process.env.PYTHON ?? 'python3', [path.join(PY_DIR, 'transcribe.py'), video, json, process.env.WHISPER_MODEL ?? 'small.en'], { maxBuffer: 16 * 1024 * 1024 });
      altyazi = JSON.parse(fs.readFileSync(json, 'utf8')).filter((w) => w.t < sure).map((w) => ({ t: w.t, d: w.d, text: w.w }));
      console.log(`  altyazı: ${altyazi.length} kelime`);
    } catch (e) {
      console.warn(`  altyazı çıkarılamadı (altyazısız devam): ${e.stderr?.toString().trim().split('\n').at(-1) ?? e.message}`);
    }
  }

  const videoPath = await renderKesit({ job, dir, video, sure, yorumlar, altyazi, settings });
  return {
    videoPath, thumbnailPath: null, duration: sure,
    credits: [`Clip: ${job.kaynak.yayinci} — ${job.kaynak.url}`],
  };
}
