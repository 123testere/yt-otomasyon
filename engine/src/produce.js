// queue/ klasöründeki senaryoları sırayla videoya çevirip YouTube'a yükler.
// Başarılı işler done/, düzeltilemeyecek olanlar failed/ klasörüne taşınır; commit'i workflow yapar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from './lib/firebase.js';
import { notify } from './lib/notify.js';
import { resolveSettings } from './lib/options.js';
import { DONE_DIR, FAILED_DIR, QUEUE_DIR } from './lib/paths.js';
import { buildVideo } from './pipeline/build.js';
import { frameFromVideo, makeShortCover } from './pipeline/cover.js';
import { queueForInstagram } from './lib/instagram-queue.js';
import { run } from './lib/util.js';
import { AuthError, QuotaError, upload } from './pipeline/youtube.js';
import { baglantiYorumu, bolumSatirlari, uploadExtras } from './pipeline/extras.js';
import { deneyAyari } from './lib/deney.js';
import { loadNeeded, usedTitles, validateJob } from './validate.js';

const MAX_ATTEMPTS = 3;
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MIN ?? 300) * 60 * 1000;

// Uygulamadaki video listesi için küçük kapak: varsa YouTube küçük resmi, yoksa videonun içinden bir kare.
// Firestore'da saklanır; videolar gizliyken YouTube kapakları dışarıya açık olmadığı için.
async function previewImage({ videoPath, thumbnailPath, duration }, dest) {
  try {
    const args = thumbnailPath
      ? ['-i', thumbnailPath]
      : ['-ss', String(Math.max(1, duration * 0.4).toFixed(1)), '-i', videoPath];
    await run('ffmpeg', ['-y', '-v', 'error', ...args, '-frames:v', '1', '-vf', 'scale=270:-2', '-q:v', '6', dest]);
    return fs.readFileSync(dest).toString('base64');
  } catch (e) {
    console.warn(`  önizleme resmi alınamadı: ${e.message}`);
    return null;
  }
}

function move(file, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  fs.renameSync(file, path.join(toDir, path.basename(file)));
}

const FULL_VIDEO = { tr: 'Videonun tamamı', de: 'Ganzes Video', en: 'Full video' };

// Uzun videodan kesit Shorts: açıklamaya uzun videonun bağlantısı (yüklenmişse) eklenir.
async function withFullVideoLink(job, settings) {
  // Fragman bölümden önce yayınlanır; bölüm o an henüz gizli olduğu için bağlantı eklenmez.
  if (!job.derivedFrom || job.fragman) return job;
  const url = (await db().doc(`videos/${job.derivedFrom}`).get()).data()?.url;
  if (!url) return job;
  const label = FULL_VIDEO[settings.language] ?? FULL_VIDEO.en;
  return { ...job, description: `${label}: ${url}

${job.description}` };
}

async function main() {
  const started = Date.now();
  const firestore = db();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'));
  const cacheDir = path.join(workDir, 'cache');
  fs.mkdirSync(cacheDir);
  const needed = loadNeeded();

  const files = fs.existsSync(QUEUE_DIR)
    ? fs.readdirSync(QUEUE_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(QUEUE_DIR, f))
    : [];
  const jobs = files
    .map((file) => {
      try {
        return { file, job: JSON.parse(fs.readFileSync(file, 'utf8')) };
      } catch (e) {
        return { file, job: null, parseError: e.message };
      }
    })
    .sort((a, b) => String(a.job?.publishAt).localeCompare(String(b.job?.publishAt)));

  console.log(`${jobs.length} iş kuyrukta.`);
  for (const { file, job, parseError } of jobs) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      console.log('Süre bütçesi doldu; kalan işler sonraki çalıştırmaya kaldı.');
      break;
    }
    const fileId = path.basename(file, '.json');
    const ref = firestore.doc(`videos/${fileId}`);
    const prev = (await ref.get()).data() ?? {};
    // Yüklenmiş ama dosyası taşınamamış (iş yarıda kesilmiş) olabilir.
    if (prev.status === 'uploaded') {
      move(file, DONE_DIR);
      continue;
    }

    const errors = parseError
      ? [`JSON okunamadı: ${parseError}`]
      : validateJob(job, { fileId, needed, takenTitles: usedTitles(job.channelId, fileId) });
    if (errors.length) {
      console.error(`✗ ${fileId}: ${errors.join('; ')}`);
      await ref.set({ channelId: job?.channelId ?? null, title: job?.title ?? fileId, type: job?.type ?? null,
        status: 'invalid', error: errors.join('\n'), updatedAt: new Date() }, { merge: true });
      move(file, FAILED_DIR);
      continue;
    }

    if (prev.retry) prev.attempts = 0;
    // Deneme hakkı biten iş kuyrukta bekler; uygulamadan "Yeniden dene" denince tekrar işlenir.
    if ((prev.attempts ?? 0) >= MAX_ATTEMPTS) continue;

    const channelSnap = await firestore.doc(`channels/${job.channelId}`).get();
    // Müzik deneyinin B kolu bir kademe kısık müzikle üretilir.
    const settings = deneyAyari(job, resolveSettings(channelSnap.data()?.settings));
    if (!channelSnap.exists || !settings.enabled) {
      await ref.set({ channelId: job.channelId, title: job.title, type: job.type, status: 'paused', updatedAt: new Date() }, { merge: true });
      continue;
    }

    console.log(`▶ ${fileId} — ${job.title}`);
    await ref.set({
      channelId: job.channelId, title: job.title, type: job.type, topic: job.topic, publishAt: new Date(job.publishAt),
      status: 'rendering', error: null, retry: false, attempts: (prev.attempts ?? 0) + 1,
      createdAt: prev.createdAt ?? new Date(), updatedAt: new Date(),
    }, { merge: true });

    try {
      const built = await buildVideo(job, settings, { workDir, cacheDir });
      // Shorts'a da dev kanca yazılı küçük resim (yüklenemezse video yine yayınlanır).
      if (job.type === 'short' && !built.thumbnailPath && job.format !== 'dizi') {
        try {
          const dir = path.join(workDir, `${job.id}-kapak`);
          fs.mkdirSync(dir, { recursive: true });
          const background = await frameFromVideo(built.videoPath, path.join(dir, 'kare.jpg'));
          built.thumbnailPath = await makeShortCover({ job, settings, background, dir });
        } catch (e) {
          console.warn(`  Shorts kapağı üretilemedi: ${e.message}`);
        }
      }
      await ref.update({
        status: 'uploading', duration: Math.round(built.duration),
        preview: await previewImage(built, path.join(workDir, `${job.id}-onizleme.jpg`)), updatedAt: new Date(),
      });

      const secret = (await firestore.doc(`secrets/${job.channelId}`).get()).data();
      if (!secret?.refreshToken) throw new AuthError('Kanalın yükleme izni yok; kanalı yeniden bağla');
      // Uzun videoda bölüm zaman damgaları açıklamaya eklenir (aramada bölümler ayrı görünür).
      const linked = await withFullVideoLink(job, settings);
      // Dizi bölümünde YouTube bölümleri transkriptin kısımlarından gelir.
      const bolumler = job.format === 'dizi' ? built.bolumlerMetni ?? null : bolumSatirlari(job, built.sahneZaman, settings.language);
      const uploadJob = bolumler ? { ...linked, description: `${linked.description.trim()}\n\n${bolumler}` } : linked;
      const yt = await upload({ secret, job: uploadJob, settings, ...built });

      await ref.update({ status: 'uploaded', youtubeId: yt.videoId, url: yt.url, scheduled: yt.scheduled,
        warning: yt.thumbnailWarning, sahneZaman: built.sahneZaman ?? null, deney: job.deney ?? null,
        ...(job.format === 'dizi' ? { dizi: job.dizi, bolum: job.bolum ?? null, transkript: built.transkript ?? null, derivedFrom: job.derivedFrom ?? null } : {}),
        updatedAt: new Date() });
      move(file, DONE_DIR);
      console.log(`✓ ${yt.url}`);
      // Altyazı, başka dillerde başlık, oynatma listesi: başarısız olsa da video yayında kalır.
      try {
        const hashtags = [settings.hashtags?.trim(), job.type === 'short' ? '#shorts' : ''].filter(Boolean).join(' ');
        const ekstra = await uploadExtras({ secret, job, settings, videoId: yt.videoId, srt: built.srt, hashtags });
        await ref.update({ ekstralar: { ...ekstra, bolumler: Boolean(bolumler) } });
        if (ekstra.izinEksik) await firestore.doc(`channels/${job.channelId}`).update({ izinEksik: true });
      } catch (e) {
        console.warn(`  ekstralar: ${e.message}`);
      }
      // Kesit Shorts'u: altına uzun videonun bağlantısıyla kanal yorumu
      if (job.type === 'short' && job.derivedFrom && !job.fragman) {
        try {
          const kaynak = (await firestore.doc(`videos/${job.derivedFrom}`).get()).data();
          if (kaynak?.url) {
            const ad = job.format === 'dizi' && job.bolum?.no ? `Bölüm ${job.bolum.no}` : 'Videonun';
            const metin = settings.language === 'tr' ? `▶ ${ad} tamamı burada: ${kaynak.url}` : `▶ Watch the full video: ${kaynak.url}`;
            await baglantiYorumu({ secret, videoId: yt.videoId, metin });
          }
        } catch (e) {
          console.warn(`  bağlantı yorumu: ${e.message}`);
        }
      }
      // Instagram açık kanallarda Shorts, yayın saatinde Reels olarak da paylaşılır (senkronizasyon gönderir).
      await queueForInstagram(firestore, await withFullVideoLink(job, settings), settings, built.videoPath);
      // Flaggenduell: maç yayınlandıktan sonra sezon tablosu kalıcı olarak güncellenir.
      if (built.leagueUpdate) await firestore.doc(`leagues/${job.channelId}`).set(built.leagueUpdate);
      // İlk yayından sonra ses ve karakter kilitlenir; kanal kimliği videodan videoya değişmesin.
      if (!settings.identityLocked) {
        await firestore.doc(`channels/${job.channelId}`).update({ 'settings.identityLocked': true });
      }
      await notify({
        title: yt.scheduled ? 'Video zamanlandı' : 'Video yüklendi',
        body: `${channelSnap.data().title}: ${job.title}`, channelId: job.channelId, videoId: fileId,
      });
    } catch (e) {
      console.error(`✗ ${fileId}: ${e.stack ?? e.message}`);
      if (e instanceof QuotaError) {
        await ref.update({ status: 'waiting-quota', attempts: prev.attempts ?? 0, error: e.message, updatedAt: new Date() });
        await notify({ level: 'warn', title: 'YouTube kotası doldu', body: 'Kalan videolar yarın otomatik yüklenecek.' });
        break;
      }
      if (e instanceof AuthError) {
        await firestore.doc(`channels/${job.channelId}`).update({ needsReconnect: true });
      }
      await ref.update({ status: 'error', error: e.message.slice(0, 2000), updatedAt: new Date() });
      await notify({ level: 'error', title: 'Video üretilemedi', body: `${job.title}: ${e.message.slice(0, 150)}`,
        channelId: job.channelId, videoId: fileId });
    } finally {
      fs.rmSync(path.join(workDir, job.id), { recursive: true, force: true });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
