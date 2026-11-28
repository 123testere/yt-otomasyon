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
import { saatleriYaz } from './lib/sosyal-saatler.js';
import { loadNeeded, usedTitles, validateJob } from './validate.js';
import { V4, v4Kanal } from './lib/master-v4.js';
import { kapaklariYayinla, studioGorevleri } from './lib/studio.js';
import { sesSeviyesi } from './pipeline/ses-seviye.js';
import { masalIkizi } from './lib/masal-kapi.js';
import { uzunKapak } from './pipeline/cover.js';

const MAX_ATTEMPTS = 3;
const KESIT_ONCE_MS = 10 * 60_000; // kesit en erken yayın saatinden 10 dk önce üretilir
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
  // Ön gösterim/fragman uzun videodan önce yayınlanır: uzun video zamanlanmış olarak yüklendiyse bağlantı eklenir,
  // uzun video yayına girdiği anda çalışır hale gelir.
  if (!job.derivedFrom) return job;
  const url = (await db().doc(`videos/${job.derivedFrom}`).get()).data()?.url;
  if (!url) return job;
  const label = FULL_VIDEO[settings.language] ?? FULL_VIDEO.en;
  return { ...job, description: `${job.fragman ? (settings.language === 'tr' ? 'Tamamı yayında olunca burada' : 'Full video (when it goes live)') : label}: ${url}

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
    // Kampanya kesiti yayın saatinde üretilip hemen yayınlanır (Whop'a 30 dk içinde gönderim o an başlar)
    if (job.kampanya && Date.parse(job.publishAt) - Date.now() > KESIT_ONCE_MS) continue;

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
      if (job.type === 'short' && !built.thumbnailPath && job.format !== 'dizi' && job.format !== 'masal') {
        try {
          const dir = path.join(workDir, `${job.id}-kapak`);
          fs.mkdirSync(dir, { recursive: true });
          const background = await frameFromVideo(built.videoPath, path.join(dir, 'kare.jpg'));
          built.thumbnailPath = await makeShortCover({ job, settings, background, dir });
        } catch (e) {
          console.warn(`  Shorts kapağı üretilemedi: ${e.message}`);
        }
      }
      // Master v4 O8: -14 LUFS / -1 dBTP; tutmazsa yayın yok
      const v4 = v4Kanal(job.channelId);
      if (v4) {
        if (!built.srt) throw new Error('Master v4 O9: Türkçe SRT altyazı üretilmedi');
        const ses = await sesSeviyesi(built.videoPath, path.join(workDir, `${job.id}-ses.mp4`));
        if (ses.hata) throw new Error(`Master v4 O8: ${ses.hata}`);
        built.videoPath = ses.dosya;
        console.log(`  ses: ${ses.lufs} LUFS, tepe ${ses.tepe} dBTP`);
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
      const bolumler = job.format === 'dizi' || job.format === 'masal' ? built.bolumlerMetni ?? null : bolumSatirlari(job, built.sahneZaman, settings.language);
      if (v4 && job.type === 'long' && !bolumler) throw new Error('Master v4 U6: bölümler oluşmadı (ilki 00:00, en az 3 bölüm, her biri en az 10 sn)');
      let uploadJob0 = bolumler ? { ...linked, description: `${linked.description.trim()}\n\n${bolumler}` } : linked;
      // Kampanya kesiti ya da kullanıcının "hemen yayınla" dediği iş (job.hemen): zamanlama yok, üretildiği an herkese açık
      let uploadJob = job.kampanya || job.hemen ? { ...uploadJob0, publishAt: new Date().toISOString() } : uploadJob0;
      // Master v4 U1/U7/S4 Studio işleri: video en az 24 saat sonrasına zamanlanır, o sürede telefondan yapılır
      // Kanal ayarı v4Bekleme false ise (Lamba, kullanıcı 2026-11-28) video planlanan saatinde çıkar, 24 saat kaydırılmaz
      if (v4 && !job.hemen && settings.v4Bekleme !== false) {
        const enErken = Date.now() + V4.studioBekleSaat * 3600_000;
        if (Date.parse(uploadJob.publishAt) < enErken) {
          uploadJob = { ...uploadJob, publishAt: new Date(enErken).toISOString() };
          await ref.update({ publishAt: new Date(enErken) });
          console.log(`  yayın ${uploadJob.publishAt} saatine kaydırıldı (Studio işleri için)`);
        }
      }
      const yt = await upload({ secret, job: uploadJob, settings, ...built });

      await ref.update({ status: 'uploaded', youtubeId: yt.videoId, url: yt.url, scheduled: yt.scheduled,
        warning: yt.thumbnailWarning, sahneZaman: built.sahneZaman ?? null, deney: job.deney ?? null,
        ...(job.format === 'dizi' ? { dizi: job.dizi, bolum: job.bolum ?? null, transkript: built.transkript ?? null, derivedFrom: job.derivedFrom ?? null } : {}),
        // Klip kampanyası: uygulama "Whop'a gönder" kartını ve 30 dk geri sayımını bundan gösterir
        ...(job.kampanya ? { kampanya: job.kampanya, kampanyaAd: job.kaynak?.yayinci ?? null, yayinlandiAt: new Date(), whopGonderildi: false } : {}),
        updatedAt: new Date() });
      move(file, DONE_DIR);
      console.log(`✓ ${yt.url}`);
      // Masal ikizi (Dodi → DodiTr): aynı hikâye diğer dilde, ikiz kanalda gecikmeli yayın için kuyruğa yazılır
      if (job.format === 'masal' && job.ikiz) {
        try { console.log(`  ikiz kuyruğa: ${masalIkizi(job, QUEUE_DIR)}`); } catch (e) { console.warn(`  ikiz: ${e.message}`); }
      }
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
      if (job.type === 'short' && job.derivedFrom) {
        try {
          const kaynak = (await firestore.doc(`videos/${job.derivedFrom}`).get()).data();
          if (kaynak?.url) {
            const ad = job.format === 'dizi' && job.bolum?.no ? `Bölüm ${job.bolum.no}` : 'Videonun';
            const saat = kaynak.publishAt?.toDate?.()?.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', hour: '2-digit', minute: '2-digit' });
            const metin = settings.language === 'tr'
              ? (job.fragman ? `▶ ${ad} tamamı ${saat ?? 'yakında'} yayında: ${kaynak.url}` : `▶ ${ad} tamamı burada: ${kaynak.url}`)
              : `▶ Watch the full video: ${kaynak.url}`;
            await baglantiYorumu({ secret, videoId: yt.videoId, metin });
          }
        } catch (e) {
          console.warn(`  bağlantı yorumu: ${e.message}`);
        }
      }
      // Instagram açık kanallarda Shorts, yayın saatinde Reels olarak da paylaşılır (senkronizasyon gönderir).
      // Reels/TikTok, YouTube ile aynı anda: v4 kaydırması dahil gerçek yayın saati
      await queueForInstagram(firestore, { ...(await withFullVideoLink(job, settings)), publishAt: uploadJob.publishAt }, settings, built.videoPath);
      // Flaggenduell: maç yayınlandıktan sonra sezon tablosu kalıcı olarak güncellenir.
      if (built.leagueUpdate) await firestore.doc(`leagues/${job.channelId}`).set(built.leagueUpdate);
      // İlk yayından sonra ses ve karakter kilitlenir; kanal kimliği videodan videoya değişmesin.
      if (!settings.identityLocked) {
        await firestore.doc(`channels/${job.channelId}`).update({ 'settings.identityLocked': true });
      }
      if (v4) {
        try {
          let kapaklar = [];
          if (job.type === 'long') {
            const bc = [];
            for (const [i, text] of [job.thumbnailTextAlt, job.thumbnailTextAlt2].entries()) {
              bc.push(await uzunKapak({ job, settings, dir: path.join(workDir, `${job.id}-studio-${i}`), text })
                .catch((e) => { console.warn(`  kapak ${'BC'[i]}: ${e.message}`); return null; }));
            }
            kapaklar = await kapaklariYayinla(job.id, [built.thumbnailPath, ...bc]);
          }
          const ilgili = job.ilgiliVideo && !/^https?:/.test(job.ilgiliVideo)
            ? (await firestore.doc(`videos/${job.ilgiliVideo}`).get()).data()?.url ?? null : job.ilgiliVideo ?? null;
          const yayinSaati = new Date(uploadJob.publishAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
          const gorevler = studioGorevleri({ job, url: yt.url, kapaklar, ilgiliUrl: ilgili, yayinSaati });
          await ref.update({ studio: { gorevler, kapaklar, basliklar: job.basliklar ?? null, ilgiliVideo: ilgili, tamam: false } });
          await notify({ level: 'warn', title: `Studio işi: ${job.title}`, body: gorevler.join('\n'), channelId: job.channelId, videoId: fileId });
        } catch (e) {
          console.warn(`  Studio paketi: ${e.message}`);
          await notify({ level: 'warn', title: `Studio işi (eksik paket): ${job.title}`,
            body: `${yt.url} — A/B testi, bitiş ekranı / ilgili video Studio'dan eklenmeli. (${e.message.slice(0, 80)})`, channelId: job.channelId, videoId: fileId });
        }
      }
      await notify(job.kampanya ? {
        // Klip kampanyası: bağlantı yayından sonra 30 dk içinde Whop / Content Rewards'a gönderilmeli
        level: 'warn', title: `${job.kaynak?.yayinci ?? 'Klip'}: 30 dk içinde Whop'a gönder`,
        body: `${yt.url} — ${job.title}`, channelId: job.channelId, videoId: fileId,
      } : {
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

// Instagram/TikTok bekleyen yayın saatleri (Apps Script zamanlayıcısı okur)
const sonra = () => saatleriYaz(db()).catch((e) => console.warn(`sosyal saatler: ${e.message}`));

main().then(sonra).catch((e) => {
  console.error(e);
  process.exit(1);
});
