// Vice City Dispatch: gece rutininden önce yarının kesit adaylarını hazırlar (kampanya başına `gunluk` kadar).
// Her aday için: klip bilgisi, konuşmanın kelime zamanlı dökümü (Whisper) ve 3 kare (25/50/75%).
// Gece rutini bunlara bakıp her klibe KENDİ yorumunu (ekran yazısı) yazar → queue/. Yorumsuz klip yayınlanmaz.
// Kullanım: node src/kesit-aday.js   (çıktı: kesit-aday/, her çalıştırmada yenilenir)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { kampanyalar } from './lib/kampanya.js';
import { PY_DIR, ROOT } from './lib/paths.js';
import { helixKlipler, kullanilanlar, uygunKlip, ytdlpKlipler } from './klip-twitch.js';
import { kesitIndir } from './pipeline/build-kesit.js';

const sh = promisify(execFile);
const PY = process.env.PYTHON ?? 'python3';
const HEDEF = path.join(ROOT, 'kesit-aday');

async function sure(dosya) {
  const { stdout } = await sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dosya]);
  return Number(stdout.trim());
}

async function main() {
  fs.rmSync(HEDEF, { recursive: true, force: true });
  fs.mkdirSync(HEDEF, { recursive: true });
  const kullanilan = new Set(kullanilanlar().map((j) => j.kaynak?.klipId));
  const anahtar = Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  const ozet = [];
  for (const k of kampanyalar().filter((x) => x.aktif)) {
    let klipler = [];
    try {
      klipler = (anahtar ? await helixKlipler(k) : await ytdlpKlipler(k)).filter((c) => uygunKlip(c, kullanilan)).sort((a, b) => b.izlenme - a.izlenme);
    } catch (e) {
      console.error(`✗ ${k.ad}: ${e.message}`);
      continue;
    }
    // Yedekli: istenenin 1 fazlası hazırlanır (rutin uygun bulmadığını atlayabilsin)
    for (const c of klipler.slice(0, (k.gunluk ?? 2) + 1)) {
      const id = `${k.id}-${String(c.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aday-'));
      try {
        const video = await kesitIndir({ url: c.url }, dir);
        const sn = await sure(video);
        const json = path.join(dir, 'konusma.json');
        await sh(PY, [path.join(PY_DIR, 'transcribe.py'), video, json, process.env.WHISPER_MODEL ?? 'small.en'], { maxBuffer: 16 * 1024 * 1024 });
        const kelimeler = JSON.parse(fs.readFileSync(json, 'utf8'));
        // Kareler: rutin görüntüye bakarak yorum yazar (uydurma olmasın)
        const kareler = [];
        for (const [i, oran] of [0.25, 0.5, 0.75].entries()) {
          const ad = `${id}-${i + 1}.jpg`;
          await sh('ffmpeg', ['-y', '-v', 'error', '-ss', (sn * oran).toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', path.join(HEDEF, ad)]);
          kareler.push({ sn: Math.round(sn * oran * 10) / 10, dosya: `kesit-aday/${ad}` });
        }
        // Zaman damgalı döküm: rutin işaretlerin saniyesini buradan seçer
        const satirlar = [];
        let cur = null;
        for (const w of kelimeler) {
          if (!cur || w.t - cur.son > 0.8 || cur.metin.split(' ').length >= 12) { if (cur) satirlar.push(cur); cur = { sn: w.t, son: w.t + w.d, metin: w.w }; }
          else { cur.metin += ` ${w.w}`; cur.son = w.t + w.d; }
        }
        if (cur) satirlar.push(cur);
        fs.writeFileSync(path.join(HEDEF, `${id}.json`), JSON.stringify({
          id, kampanya: k.id, yayinci: k.ad, zorunluAd: k.zorunluAd, etiketler: k.etiketler, twitch: k.twitch,
          klip: { id: c.id, url: c.url, baslik: c.baslik, izlenme: c.izlenme, tarih: c.tarih, sure: Math.round(sn * 10) / 10 },
          kareler,
          dokum: satirlar.map((s) => ({ sn: Math.round(s.sn * 10) / 10, metin: s.metin })),
        }, null, 2));
        ozet.push(`${k.ad}: ${c.baslik} (${c.izlenme} izlenme, ${Math.round(sn)} sn, ${kelimeler.length} kelime)`);
        console.log(`  + ${ozet.at(-1)}`);
      } catch (e) {
        console.error(`  ✗ ${k.ad} ${c.id}: ${e.stderr?.toString().trim().split('\n').at(-1) ?? e.message}`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  console.log(`✓ ${ozet.length} aday hazır (kesit-aday/)`);
}

main();
