// Animasyonlu dizi bölümü (format "dizi"): her satır konuşan karakterin sesiyle okunur, mekân ve karakterler kodla
// çizilir (remotion/src/Dizi.jsx). Dizinin karakterleri ve sesleri diziler/<dizi>.json dosyasındadır.
// Ses: karakterde `ses.eleven` (ElevenLabs ses kimliği) varsa ElevenLabs, yoksa edge-tts (voice/rate/pitch).
// ElevenLabs sonuçları önbelleğe alınır: aynı satır yeniden render edilirse kredi harcanmaz.
// Çıktıya zaman damgalı transkript (kısım, saniye, olan biten, kim ne dedi) ve YouTube bölümleri eklenir.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.js';
import { probeDuration, retry, run } from '../lib/util.js';
import { spellNumbersTr } from '../lib/numbers-tr.js';
import { alignWords } from './subtitles.js';
import { pickMusic } from './render.js';
import { remotionStill, renderDizi } from './remotion.js';
import { elevenScene } from './elevenlabs.js';
import { klonSatirlari, proportionalWords } from './clone.js';

export const DIZI_DIR = path.join(ROOT, 'diziler');
const PY = process.env.PYTHON ?? 'python3';
const ELEVEN_CACHE = process.env.ELEVEN_CACHE ?? path.join(ROOT, '.cache', 'eleven');
const KART_SN = 2.4; // açılış kartı (Dizi.jsx ile aynı)
const KAPANIS_SN = 3.2; // kapanış kartı
const ARA_KART_SN = 2.2; // kısım kartı ("15 YIL ÖNCE")
const SATIR_ARASI = 0.22;
const SAHNE_ARASI = 0.35;

export function diziYukle(id) {
  const file = path.join(DIZI_DIR, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`dizi bulunamadı: diziler/${id}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// 48 kHz stereo 16 bit sessiz WAV
function sessiz(file, sn) {
  const n = Math.round(Math.max(0.01, sn) * 48000) * 4;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(192000, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  fs.writeFileSync(file, b);
  return file;
}

// Rakamlar okunuşuyla seslendirilir, altyazıda rakam kalsın diye kelimeler geri toplanır.
function rakamGrupla(metin, words, dil = 'tr') {
  if (dil !== 'tr') return words;
  if (!/\d/.test(metin)) return words;
  const tokens = metin.trim().split(/\s+/);
  const counts = tokens.map((t) => spellNumbersTr(t).split(/\s+/).filter(Boolean).length);
  if (counts.reduce((a, b) => a + b, 0) !== words.length) return words;
  let k = 0;
  return tokens.map((token, i) => {
    const part = words.slice(k, (k += counts[i]));
    const last = part.at(-1);
    return { t: part[0].t, d: last.t + last.d - part[0].t, w: token };
  });
}

// Döner: { words: [{t, d, w}], file } (file: ffmpeg'e verilecek ham ses)
async function satirSesi(metin, ses, base, dil = 'tr', klonWav = null) {
  const okunus = dil === 'tr' ? spellNumbersTr(metin) : metin;
  if (ses.klon) {
    // Chatterbox kelime zamanı vermez; kelimeler satırın süresine okunuş uzunluğuyla dağıtılır.
    if (!klonWav) throw new Error('klon sesi üretilmedi');
    return { words: proportionalWords(metin, await probeDuration(klonWav)), file: klonWav };
  }
  if (ses.eleven) {
    fs.mkdirSync(ELEVEN_CACHE, { recursive: true });
    const key = crypto.createHash('sha1').update(JSON.stringify([okunus, ses.eleven, ses.speed ?? 1, ses.ayar ?? null])).digest('hex');
    const mp3 = path.join(ELEVEN_CACHE, `${key}.mp3`);
    const json = path.join(ELEVEN_CACHE, `${key}.json`);
    if (!fs.existsSync(mp3) || !fs.existsSync(json)) {
      const r = await retry(() => elevenScene(okunus, { voiceId: ses.eleven, speed: ses.speed ?? 1, voiceSettings: ses.ayar ?? {} }, mp3),
        { label: 'ElevenLabs', tries: 2, delayMs: 5000 });
      fs.writeFileSync(json, JSON.stringify(r.words));
    }
    fs.copyFileSync(mp3, `${base}.mp3`);
    return { words: JSON.parse(fs.readFileSync(json, 'utf8')), file: `${base}.mp3` };
  }
  fs.writeFileSync(`${base}.txt`, okunus);
  await retry(() => run(PY, [path.join(ROOT, 'engine', 'py', 'tts.py'), `${base}.txt`, ses.voice, ses.rate ?? '+0%', `${base}.mp3`, `${base}.json`, ses.pitch ?? '+0Hz']),
    { label: 'seslendirme', delayMs: 5000 });
  return { words: JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')), file: `${base}.mp3` };
}

const sesOf = (dizi, kim) => (kim === 'anlatici' ? dizi.anlatici?.ses : dizi.karakterler[kim]?.ses) ?? dizi.anlatici.ses;

export async function seslendir(job, dizi, dir) {
  // Shorts kesiti: açılış kartı yok (ilk saniyeden kanca), anlatım hızlandırılır (hiz), aralar kısalır.
  const acilis = job.acilis === false ? 0 : KART_SN;
  const hiz = job.hiz ?? 1;
  const [satirArasi, sahneArasi] = hiz > 1 ? [0.1, 0.18] : [SATIR_ARASI, SAHNE_ARASI];
  const parcalar = acilis ? [sessiz(path.join(dir, 'bas.wav'), acilis)] : [];
  let t = acilis;
  const words = [];
  const scenes = [];
  const sil = (ad, sn) => { parcalar.push(sessiz(path.join(dir, ad), sn)); t += sn; };
  const dil = dizi.dil ?? 'tr';
  // Kendi ses (Chatterbox) kullanan satırlar önceden, tek seferde seslendirilir.
  const klonlar = new Map();
  const klonMetin = job.scenes.flatMap((sc) => sc.satirlar ?? []).filter((s) => sesOf(dizi, s.kim ?? 'anlatici').klon).map((s) => s.metin.trim());
  if (klonMetin.length) {
    const kdir = path.join(dir, 'klon-is'); fs.mkdirSync(kdir, { recursive: true });
    const dosyalar = await klonSatirlari(job.channelId, klonMetin, dil, kdir, dizi.anlatici?.ses?.ayar ?? {});
    klonMetin.forEach((m, k) => klonlar.set(`${k}`, dosyalar[k]));
  }
  let klonSira = 0;
  for (const [i, sc] of job.scenes.entries()) {
    const t0 = t;
    const kartSn = sc.kart ? sc.kartSn ?? ARA_KART_SN : 0;
    if (kartSn) sil(`k${i}.wav`, kartSn);
    const satirlar = [];
    for (const [j, s] of (sc.satirlar ?? []).entries()) {
      if (s.once) sil(`o${i}-${j}.wav`, s.once);
      const kim = s.kim ?? 'anlatici';
      const base = path.join(dir, `s${String(i).padStart(2, '0')}-${String(j).padStart(2, '0')}`);
      const ses = sesOf(dizi, kim);
      const { words: raw, file: girdi } = await satirSesi(s.metin.trim(), ses, base, dil, ses.klon ? klonlar.get(`${klonSira++}`) : null);
      const son = j === sc.satirlar.length - 1;
      const filtre = [hiz !== 1 ? `atempo=${hiz}` : null, `apad=pad_dur=${son ? sahneArasi : satirArasi}`].filter(Boolean).join(',');
      await run('ffmpeg', ['-y', '-v', 'error', '-i', girdi, '-af', filtre, '-ar', '48000', '-ac', '2', `${base}.wav`]);
      const d = await probeDuration(`${base}.wav`);
      const hizali = alignWords(s.metin, rakamGrupla(s.metin, raw, dil));
      for (const w of hizali) words.push({ t: t + w.t / hiz, d: w.d / hiz, text: w.text, konusan: kim });
      satirlar.push({ kim, t0: t, t1: t + d, ifade: s.ifade ?? null, poz: s.poz ?? null, metin: s.metin });
      parcalar.push(`${base}.wav`);
      t += d;
    }
    // Aksiyon sahnesi: konuşma kısa kalsa da sahne en az `sure` saniye sürer
    if (sc.sure && t - t0 < sc.sure) sil(`e${i}.wav`, sc.sure - (t - t0));
    if (!sc.satirlar?.length && !sc.sure) sil(`b${i}.wav`, 2);
    scenes.push({
      t0, d: t - t0, mekan: sc.mekan, zaman: sc.zaman ?? 'gece', efektler: sc.efektler ?? [], saat: sc.saat ?? '03:17',
      kalabalik: sc.kalabalik ?? null, kart: sc.kart ?? null, kartSn, kadraj: sc.kadraj ?? [], nesneler: sc.nesneler ?? [],
      zincir: sc.zincir ?? null, cizim: sc.cizim ?? null, ozet: Boolean(sc.ozet), satirlar,
      buyukYazi: sc.buyukYazi ?? null, veri: sc.veri ?? null, sira: sc.sira ?? null,
    });
  }
  parcalar.push(sessiz(path.join(dir, 'son.wav'), KAPANIS_SN));
  t += KAPANIS_SN;
  scenes.at(-1).d += KAPANIS_SN;
  const list = path.join(dir, 'ses-liste.txt');
  fs.writeFileSync(list, parcalar.map((p) => `file '${path.basename(p)}'`).join('\n'));
  const narration = path.join(dir, 'anlatim.wav');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', narration], { cwd: dir });
  return { narration, total: t, words, scenes };
}

const zaman = (sn) => `${Math.floor(sn / 60)}:${String(Math.floor(sn % 60)).padStart(2, '0')}`;

// Zaman damgalı transkript (bölüm planıyla aynı biçim) ve YouTube bölüm satırları.
export function transkript(job, dizi, ses) {
  const kisimlar = [];
  job.scenes.forEach((sc, i) => {
    if (sc.kisim || i === 0) kisimlar.push({ ad: sc.kisim ?? job.bolum?.ad ?? 'Başlangıç', bas: i === 0 ? 0 : ses.scenes[i].t0, sahneler: [] });
    kisimlar.at(-1).sahneler.push(i);
  });
  const ad = (kim) => (kim === 'anlatici' ? `${(dizi.karakterler[dizi.anlatici?.id]?.ad ?? 'Anlatıcı').toLocaleUpperCase('tr')} (anlatıcı)` : (dizi.karakterler[kim]?.ad ?? kim).toLocaleUpperCase('tr'));
  const satirlar = [`# ${dizi.ad} — Bölüm ${job.bolum?.no ?? ''}: ${job.bolum?.ad ?? ''}`, ''];
  kisimlar.forEach((k, n) => {
    const bitis = kisimlar[n + 1]?.bas ?? ses.total;
    satirlar.push(`**[${zaman(k.bas)} – ${zaman(bitis)}] ${k.ad.toLocaleUpperCase('tr')}**`);
    for (const i of k.sahneler) {
      const sc = job.scenes[i];
      if (sc.aciklama) satirlar.push(`*${sc.aciklama}*`);
      for (const s of ses.scenes[i].satirlar) satirlar.push(`- \`${zaman(s.t0)}\` **${ad(s.kim)}:** ${s.metin}`);
    }
    satirlar.push('');
  });
  // YouTube bölümleri: ilk 0:00, her biri en az 10 sn
  const bolumler = kisimlar.filter((k, n) => n === 0 || k.bas - kisimlar[n - 1].bas >= 10)
    .map((k, n) => `${n === 0 ? '0:00' : zaman(k.bas)} ${k.ad}`);
  return { metin: satirlar.join('\n'), bolumler: bolumler.length >= 3 ? bolumler.join('\n') : null };
}

const srtZaman = (sn) => {
  const ms = Math.round(sn * 1000);
  const p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

// YouTube altyazısı: her konuşma satırı bir altyazı (konuşan karakterin sesiyle zamanlanmış).
export function diziSrt(ses) {
  const satirlar = ses.scenes.flatMap((sc) => sc.satirlar);
  return satirlar.map((s, i) => `${i + 1}\n${srtZaman(s.t0)} --> ${srtZaman(Math.max(s.t0 + 0.5, s.t1 - 0.05))}\n${s.metin}\n`).join('\n');
}

// Kapak yazısı iki satıra bölünür (ikinci satır altın renginde).
function kapakSatirlari(text) {
  const w = String(text ?? '').trim().toLocaleUpperCase('tr').split(/\s+/).filter(Boolean);
  if (w.length <= 1) return w;
  const k = Math.ceil(w.length / 2);
  return [w.slice(0, k).join(' '), w.slice(k).join(' ')];
}

// Uzun bölüm kapağı: seçilen sahnenin (job.kapak.sahne) seçilen anı (job.kapak.sn), solda dev yazı.
// Sesten bağımsız çizilir; kapak denemesi (kapak-dene.js) yedek yazıyla aynı kareyi yeniden üretir.
export async function diziKapak({ job, dir, text }) {
  fs.mkdirSync(dir, { recursive: true });
  const dizi = diziYukle(job.dizi);
  const k = Math.min(Math.max(0, job.kapak?.sahne ?? 0), job.scenes.length - 1);
  const sc = job.scenes[k];
  const sahne = {
    t0: 0, d: 30, mekan: sc.mekan, zaman: sc.zaman ?? 'gece', efektler: (sc.efektler ?? []).filter((e) => e !== 'beyaz-cakma'),
    saat: sc.saat ?? '03:17', kalabalik: sc.kalabalik ?? null, kart: null, kartSn: 0, kadraj: sc.kadraj ?? [],
    nesneler: sc.nesneler ?? [], zincir: null, cizim: null, ozet: false, satirlar: [],
  };
  const yatay = dizi.format === 'yatay' && !job.dikey;
  const png = await remotionStill(yatay ? 'DiziKareYatay' : 'DiziKare', {
    ...(yatay ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 }),
    scenes: [sahne], words: [], stil: dizi.stil ?? 'yuz', karakterler: dizi.karakterler, dizi: { ad: '' }, bolum: {},
    kapanis: null, acilis: false, t: Number(job.kapak?.sn ?? 1.5), dur: 30, kapakYazi: kapakSatirlari(text),
  }, path.join(dir, 'kapak.png'), `${job.id}-kapak`);
  const jpg = path.join(dir, 'kapak.jpg');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-vf', 'scale=1280:-2', '-q:v', '3', jpg]);
  return jpg;
}

export async function buildDizi(job, settings, { workDir }) {
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });
  const dizi = diziYukle(job.dizi);
  console.log('  seslendirme (karakter sesleri)…');
  const ses = await seslendir(job, dizi, dir);
  const muzik = job.muzik ?? dizi.muzik ?? (settings.music && settings.music !== 'yok' ? settings.music : 'gerilim');
  const music = await pickMusic(muzik, dir);
  console.log(`  ${job.scenes.length} sahne, ${Math.round(ses.total)} sn — animasyon render (Remotion)…`);
  const no = job.bolum.no;
  const saat = (dizi.format === 'yatay' ? settings.long?.time : settings.shorts?.times?.[0]) ?? '19:00';
  const yatay = (job.format === 'dizi' && job.dikey) ? false : dizi.format === 'yatay';
  const videoPath = await renderDizi({
    job, dir, ses, music, musicVolume: Number(job.muzikSeviye ?? dizi.muzikSeviye ?? settings.musicVolume ?? 0.12),
    boyut: yatay ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 },
    props: {
      dil: dizi.dil ?? 'tr', rozetNo: dizi.rozetNo !== false,
      acilis: job.acilis !== false, stil: dizi.stil ?? 'yuz', dizi: { ad: dizi.ad }, bolum: { no, toplam: dizi.toplam ?? null, ad: job.bolum.ad }, karakterler: dizi.karakterler,
      kapanis: job.kapanis ? {
        baslik: job.kapanis.baslik ?? 'DEVAMI', soru: job.kapanis.soru ?? null,
        sonraki: job.kapanis.sonraki ?? (dizi.toplam && no >= dizi.toplam ? 'Sezon finali' : `Bölüm ${no + 1} yakında`),
      } : null,
    },
  });
  void saat;
  const tr = transkript(job, dizi, ses);
  let thumbnailPath = null;
  if (job.type === 'long') {
    try {
      thumbnailPath = await diziKapak({ job, dir: path.join(dir, 'kapak'), text: job.thumbnailText });
    } catch (e) {
      console.warn(`  kapak üretilemedi: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(dir, 'transkript.md'), tr.metin);
  const credits = [music?.credit].filter(Boolean);
  return {
    videoPath, thumbnailPath, duration: ses.total, credits, sahneZaman: ses.scenes.map((s) => Math.round(s.t0 * 10) / 10),
    srt: diziSrt(ses), transkript: tr.metin, bolumlerMetni: tr.bolumler,
  };
}
