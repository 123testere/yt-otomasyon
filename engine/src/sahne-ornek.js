// Seslendirmesiz önizleme: saniye saniye tanımlanmış sahneleri (dizi formatı) doğrudan videoya çevirir.
// YouTube'a yüklemez, ses/kredi harcamaz. İki kullanım:
//   1) Örnek dosyası: { id, dizi, dikey?, scenes: [{ mekan, sure, kadraj, nesneler, efektler, gecit, kapi, yerKapak, duvarZincir, yazi }] }
//   2) Gerçek bölüm senaryosu (queue/…json): konuşma satırlarının süresi kelime sayısından tahmin edilir (~2,6 kelime/sn),
//      altyazı, ağız hareketi ve satıra bağlı adımlar (adim.satir) yerine oturur; açılış tanıtımı ve kapanış kartı da çizilir.
// Kullanım: node src/sahne-ornek.js <dosya.json> [çıktı klasörü]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diziYukle, ozelMekanlar, sahneMuzikleri } from './pipeline/build-dizi.js';
import { renderDizi } from './pipeline/remotion.js';

const KELIME_SN = 2.6;
const KAPANIS_SN = 3.2;
const [file, out = path.join('..', 'ornek-videolar')] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(file, 'utf8'));
const dizi = diziYukle(job.dizi);
const hiz = job.hiz ?? 1;
let t = 0;
const words = [];
const scenes = job.scenes.map((sc) => {
  for (const k of sc.kadraj ?? []) if (!dizi.karakterler[k.id]) throw new Error(`karakter yok: ${k.id}`);
  const t0 = t;
  // Ekran yazısı (örneklerde): yazi: [{sn, d, metin}] altyazı olarak gösterilir
  for (const y of sc.yazi ?? []) {
    const kel = y.metin.split(/\s+/);
    kel.forEach((w, i) => words.push({ t: t0 + y.sn + (i * (y.d ?? 1.5)) / kel.length, d: (y.d ?? 1.5) / kel.length, text: w, konusan: 'anlatici' }));
  }
  // Konuşma satırları: tahmini süreyle sırayla
  const satirlar = [];
  for (const s of sc.satirlar ?? []) {
    t += s.once ?? 0;
    const kel = s.metin.trim().split(/\s+/);
    const d = Math.max(1, kel.length / KELIME_SN / hiz) + 0.2;
    kel.forEach((w, i) => words.push({ t: t + (i * (d - 0.2)) / kel.length, d: (d - 0.2) / kel.length, text: w, konusan: s.kim ?? 'anlatici' }));
    satirlar.push({ kim: s.kim ?? 'anlatici', t0: t, t1: t + d, ifade: s.ifade ?? null, poz: s.poz ?? null, metin: s.metin });
    t += d;
  }
  t = Math.max(t, t0 + (sc.sure ?? (satirlar.length ? 0 : 2)));
  return { zaman: 'gece', efektler: [], nesneler: [], kart: null, kartSn: 0, ...sc, satirlar, t0, d: t - t0 };
});
if (job.kapanis) { scenes.at(-1).d += KAPANIS_SN; t += KAPANIS_SN; }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sahne-ornek-'));
// Sahneye göre müzik (internet yoksa müziksiz devam eder); efekt ve ortam sesleri çizicide sahneden çıkarılır
const { muzikler } = job.muzik === 'yok' ? { muzikler: [] } : await sahneMuzikleri(scenes, dizi, job.muzik ?? dizi.muzik ?? 'gizemli', dir);
console.log('  müzik: ' + (muzikler.map((m) => m.mood + ' ' + Math.round(m.t0) + '-' + Math.round(m.t1) + ' sn').join(', ') || 'yok'));
const yatay = !job.dikey && dizi.format === 'yatay';
const video = await renderDizi({
  job: { id: job.id }, dir, ses: { total: t, scenes, words, narration: null }, music: null, muzikler, musicVolume: Number(job.muzikSeviye ?? dizi.muzikSeviye ?? 0.12),
  boyut: yatay ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 },
  props: {
    dil: dizi.dil ?? 'tr', rozetNo: false, acilis: false, stil: dizi.stil ?? 'cop', dizi: { ad: dizi.ad }, bolum: job.bolum ?? {},
    karakterler: dizi.karakterler, ozelMekanlar: ozelMekanlar(job), tanitim: job.tanitim ?? null,
    kapanis: job.kapanis ? { baslik: job.kapanis.baslik ?? 'DEVAMI', soru: job.kapanis.soru ?? null, sonraki: job.kapanis.sonraki ?? '' } : null,
  },
});
fs.mkdirSync(out, { recursive: true });
const hedef = path.join(out, `${job.id}.mp4`);
fs.copyFileSync(video, hedef);
// Sahne zaman çizelgesi (önizlemeyi senaryoyla karşılaştırmak için)
for (const [i, s] of scenes.entries()) console.log(`  sahne ${String(i + 1).padStart(2)}  ${s.t0.toFixed(1).padStart(5)}-${(s.t0 + s.d).toFixed(1).padStart(5)} sn  ${s.mekan}`);
console.log(`✓ ${hedef} (${Math.round(t)} sn)`);
