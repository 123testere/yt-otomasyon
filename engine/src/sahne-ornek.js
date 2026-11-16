// Seslendirmesiz sahne örneği: saniye saniye tanımlanmış sahneleri (dizi formatı) doğrudan videoya çevirir.
// YouTube'a yüklemez, ses/kredi harcamaz. Görüntü kalitesini denemek içindir.
// Kullanım: node src/sahne-ornek.js <ornek.json> <çıktı klasörü>
// ornek.json: { id, dizi, dikey?, scenes: [{ mekan, sure (sn), kadraj, nesneler, efektler, gecit, kalabalik, zincir }] }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diziYukle } from './pipeline/build-dizi.js';
import { renderDizi } from './pipeline/remotion.js';

const [file, out = 'ornek-videolar'] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(file, 'utf8'));
const dizi = diziYukle(job.dizi);
let t = 0;
const scenes = job.scenes.map((sc) => {
  for (const k of sc.kadraj ?? []) if (!dizi.karakterler[k.id]) throw new Error(`karakter yok: ${k.id}`);
  const s = { zaman: 'gece', efektler: [], nesneler: [], satirlar: [], kart: null, kartSn: 0, ...sc, t0: t, d: sc.sure };
  t += sc.sure;
  return s;
});
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sahne-ornek-'));
const video = await renderDizi({
  job: { id: job.id }, dir, ses: { total: t, scenes, words: [], narration: null }, music: null, musicVolume: 0,
  boyut: job.dikey ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 },
  props: { dil: dizi.dil ?? 'tr', rozetNo: false, acilis: false, stil: dizi.stil ?? 'cop', dizi: { ad: dizi.ad }, bolum: {}, karakterler: dizi.karakterler, kapanis: null },
});
fs.mkdirSync(out, { recursive: true });
const hedef = path.join(out, `${job.id}.mp4`);
fs.copyFileSync(video, hedef);
console.log(`✓ ${hedef} (${t} sn)`);
