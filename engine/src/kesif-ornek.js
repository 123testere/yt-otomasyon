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
import { execFileSync } from 'node:child_process';
import { buildVideo } from './pipeline/build.js';
import { remotionStill } from './pipeline/remotion.js';

const PARCA = 700_000;
// Dile göre varsayılan Microsoft sesleri: [erkek, kadın]
const SESLER = {
  tr: ['tr-TR-AhmetNeural', 'tr-TR-EmelNeural'], en: ['en-US-AndrewNeural', 'en-US-JennyNeural'],
  de: ['de-DE-ConradNeural', 'de-DE-KatjaNeural'], es: ['es-MX-JorgeNeural', 'es-MX-DaliaNeural'],
  pt: ['pt-BR-AntonioNeural', 'pt-BR-FranciscaNeural'], fr: ['fr-FR-HenriNeural', 'fr-FR-DeniseNeural'],
};
const kesifVerisi = new Map();
const k0 = (id) => kesifVerisi.get(id); // base64 karakter (Firestore belge sınırı 1 MB)
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
  const diziDosya = path.join(ROOT, 'diziler', `${job.dizi}.json`);
  const dizi = JSON.parse(fs.readFileSync(diziDosya, 'utf8'));
  // Güvence: dizinin dili fırsatın dilidir; Microsoft sesleri o dilde değilse o dilin sesine çevrilir
  dizi.dil = dizi.dil ?? k0(id)?.firsat?.dil ?? 'tr';
  let duzeldi = false;
  const sesDuzelt = (ses) => {
    if (!ses?.voice || ses.voice.toLowerCase().startsWith(`${dizi.dil}-`)) return ses;
    duzeldi = true;
    const kadin = /Jenny|Aria|Emel|Katja|Dalia|Francisca|Sonia|Libby|Ava|Emma|Elvira|Amala/i.test(ses.voice);
    return { ...ses, voice: SESLER[dizi.dil]?.[kadin ? 1 : 0] ?? ses.voice };
  };
  if (dizi.anlatici?.ses) dizi.anlatici.ses = sesDuzelt(dizi.anlatici.ses);
  for (const c of Object.values(dizi.karakterler ?? {})) if (c.ses) c.ses = sesDuzelt(c.ses);
  if (duzeldi) { fs.writeFileSync(diziDosya, JSON.stringify(dizi, null, 1)); console.log(`  sesler ${dizi.dil} diline göre düzeltildi`); }
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
// Pilot dosyasının git'e girdiği an (Claude yeni pilotu yazdı mı?)
const pilotZamani = (id) => {
  try {
    return Number(execFileSync('git', ['log', '-1', '--format=%ct', '--', `kesif/${id}/pilot.json`], { cwd: ROOT }).toString().trim()) * 1000;
  } catch {
    return 0;
  }
};

for (const id of ids) {
  if (!fs.existsSync(path.join(KESIF_DIR, id, 'pilot.json'))) continue;
  const k = (await firestore.doc(`kesif/${id}`).get()).data() ?? {};
  kesifVerisi.set(id, k);
  if (!hedef) {
    // 'ornek-tekrar': mevcut pilot yeniden üretilir (ör. ses servisi aksadıysa).
    // 'ornek-istendi': sadece Claude isteğe göre YENİ pilot yazdıysa (eski pilot tekrar üretilmez).
    const yeniPilot = pilotZamani(id) > (k.istekAt?.toMillis?.() ?? 0);
    if (!(k.durum === 'ornek-tekrar' || k.durum === 'ornek-yazildi' || (k.durum === 'ornek-istendi' && yeniPilot))) continue;
  }
  await isle(id);
}
process.exit(0);
