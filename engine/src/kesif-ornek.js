// Keşif örneği: Claude'un yazdığı pilot senaryoyu (kesif/<id>/pilot.json) render eder, kanal kimliği önizlemesini
// (profil + banner) çizer. Hiçbir kanala yüklemez: video küçültülüp Firestore'a parçalar halinde konur (kesifVideo/),
// uygulama birleştirip oynatır. Kullanım: node src/kesif-ornek.js [kesifId]  (boşsa: "ornek-yazildi" durumundakiler)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from './lib/firebase.js';
import { notify } from './lib/notify.js';
import { resolveSettings } from './lib/options.js';
import { ROOT } from './lib/paths.js';
import { run } from './lib/util.js';
import { buildVideo } from './pipeline/build.js';
import { remotionStill } from './pipeline/remotion.js';

const PARCA = 700_000; // base64 karakter (Firestore belge sınırı 1 MB)
const firestore = db();
const KESIF_DIR = path.join(ROOT, 'kesif');

async function jpg(id, props, dir, ad, genislik) {
  const png = await remotionStill(id, props, path.join(dir, `${ad}.png`), `kesif-${ad}`);
  const out = path.join(dir, `${ad}.jpg`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-vf', `scale=${genislik}:-2`, '-q:v', '4', out]);
  return fs.readFileSync(out).toString('base64');
}

async function isle(id) {
  const ref = firestore.doc(`kesif/${id}`);
  const klasor = path.join(KESIF_DIR, id);
  const job = JSON.parse(fs.readFileSync(path.join(klasor, 'pilot.json'), 'utf8'));
  const kimlik = JSON.parse(fs.readFileSync(path.join(klasor, 'kimlik.json'), 'utf8'));
  const dizi = JSON.parse(fs.readFileSync(path.join(ROOT, 'diziler', `${job.dizi}.json`), 'utf8'));
  await ref.set({ durum: 'ornek-hazirlaniyor', hata: null }, { merge: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kesif-'));
  try {
    console.log(`▶ ${id}: ${job.title}`);
    const built = await buildVideo({ ...job, channelId: job.channelId ?? 'KESIF' }, resolveSettings({ contentFormat: 'dizi', music: dizi.muzik ?? 'epik' }), { workDir: work, cacheDir: work });
    // Telefonda izlemek için küçültülür (540p, ~2-5 MB)
    const kucuk = path.join(work, 'ornek.mp4');
    const dikey = job.dikey !== false && (job.type === 'short' || dizi.format !== 'yatay');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', built.videoPath, '-vf', dikey ? 'scale=540:-2' : 'scale=960:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', kucuk]);
    const b64 = fs.readFileSync(kucuk).toString('base64');
    const parcalar = Math.ceil(b64.length / PARCA);
    // Önceki örneğin parçaları silinir (yeni örnek daha az parçalı olabilir)
    for (const eski of (await firestore.collection('kesifVideo').where('kesif', '==', id).get()).docs) await eski.ref.delete();
    for (let i = 0; i < parcalar; i++) {
      await firestore.doc(`kesifVideo/${id}_${i}`).set({ kesif: id, n: i, toplam: parcalar, veri: b64.slice(i * PARCA, (i + 1) * PARCA) });
    }
    // Kanal kimliği önizlemesi: dizinin ana karakteri ve renk paleti
    const karakter = dizi.karakterler[kimlik.anaKarakter] ?? Object.values(dizi.karakterler)[0];
    const brand = { title: kimlik.kanalAdlari?.[0] ?? dizi.ad, tagline: kimlik.slogan ?? '', accent: kimlik.renkler?.[1], karakter, renkler: kimlik.renkler };
    await firestore.doc(`kesifGorsel/${id}`).set({
      profil: await jpg('Avatar', brand, work, 'profil', 400),
      banner: await jpg('Banner', brand, work, 'banner', 1280),
    });
    await ref.set({
      durum: 'ornek-hazir', kimlik,
      ornek: { parca: parcalar, boyutKB: Math.round((b64.length * 0.75) / 1024), sure: Math.round(built.duration), baslik: job.title ?? job.bolum?.ad ?? '', dizi: job.dizi, at: new Date() },
    }, { merge: true });
    await notify({ title: 'Keşif: örnek video hazır', body: `${kimlik.kanalAdlari?.[0] ?? ''} — ${job.title}. Uygulamada Keşif sekmesinden izle.` });
    console.log(`✓ ${id}: ${Math.round(built.duration)} sn, ${parcalar} parça`);
  } catch (e) {
    console.error(`✗ ${id}: ${e.stack ?? e.message}`);
    await ref.set({ durum: 'ornek-hata', hata: e.message.slice(0, 300) }, { merge: true });
    await notify({ level: 'error', title: 'Keşif örneği üretilemedi', body: e.message.slice(0, 150) });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const hedef = process.argv[2];
const ids = hedef ? [hedef] : (fs.existsSync(KESIF_DIR) ? fs.readdirSync(KESIF_DIR) : []);
for (const id of ids) {
  if (!fs.existsSync(path.join(KESIF_DIR, id, 'pilot.json'))) continue;
  const durum = (await firestore.doc(`kesif/${id}`).get()).data()?.durum;
  if (!hedef && !['ornek-yazildi', 'ornek-istendi'].includes(durum)) continue;
  await isle(id);
}
process.exit(0);
