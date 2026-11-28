// Masal formatı (Dodi / DodiTr): işteki `hikaye` sahne sahne seslendirilir, remotion/src/Masal.tsx kodla çizer.
// Uzun masal 1920x1080, Shorts 1080x1920. Konuşma -18 LUFS, müzik/ortam Masal.tsx'te konuşurken kısılır; çıktı -14 LUFS.
// Ses: settings.voiceSource 'klon' → kanal sahibinin Chatterbox klonu (ücretsiz, kelime zamanı orantılı dağıtılır);
// aksi hâlde ElevenLabs (kelime zamanları gerçek).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.js';
import { run } from '../lib/util.js';
import { elevenScene } from './elevenlabs.js';
import { klonSatirlari, proportionalWords } from './clone.js';
import { parcaSeviyesi, sesSeviyesi } from './ses-seviye.js';
import { sfxHazirla } from '../lib/sfx.js';

const DIR = path.join(ROOT, 'remotion');
const FPS = 30, SR = 48000;
const MUZIK_AD = { 'dreamy-flashback': 'Dreamy Flashback', carefree: 'Carefree', 'meditation-impromptu-01': 'Meditation Impromptu 01' };
const BOLUM_MUZIK = ['dreamy-flashback', 'carefree', 'carefree', 'dreamy-flashback', 'meditation-impromptu-01', 'dreamy-flashback'];

async function remotionCli(args) {
  const cli = path.join(DIR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  await run(process.execPath, [cli, ...args, '--log=error'], { cwd: DIR });
}

// mp3/wav → 48 kHz mono 16 bit PCM (başlıksız)
async function pcm(dosya, dir, i) {
  const out = path.join(dir, `p${i}.raw`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', dosya, '-ar', String(SR), '-ac', '1', '-f', 's16le', out]);
  return fs.readFileSync(out);
}
const wavBasligi = (n) => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(n, 40); return h; };

export function masalMuzikleri(hikaye) {
  const set = new Set(); let bi = -1;
  for (const s of hikaye.sahneler) { if (s.bolum) bi++; set.add(s.muzik ?? BOLUM_MUZIK[Math.max(0, bi)] ?? 'dreamy-flashback'); }
  return [...set];
}

// Sahne metinlerini seslendirir, tek anlatım dosyasında birleştirir. Döner: { dosya, sure, sahne:[{t0,t1}], words:[{w,t,d,s}] }
async function seslendir(job, settings, dir) {
  const dil = settings.language, H = job.hikaye, uzun = job.type === 'long';
  const metinler = H.sahneler.map((s) => String(s[dil] ?? '').trim());
  const klon = settings.voiceSource === 'klon';
  const parcalar = []; // { dosya, words (sahne içi, sn) }
  if (klon) {
    const wavs = await klonSatirlari(job.channelId, metinler, dil, dir, {});
    for (const [i, w] of wavs.entries()) parcalar.push({ dosya: w, metin: metinler[i] });
  } else {
    const voiceId = settings.elevenVoiceId?.trim() || process.env.ELEVENLABS_VOICE_ID;
    for (const [i, metin] of metinler.entries()) {
      const dest = path.join(dir, `s${i}.mp3`);
      let r;
      for (let k = 0; ; k++) {
        try { r = await elevenScene(metin, { voiceId, speed: 0.92, voiceSettings: { stability: 0.55, similarity_boost: 0.85, style: 0.4 } }, dest); break; }
        catch (e) { if (k >= 2) throw e; console.warn(`  ses tekrar (${i}): ${e.message}`); }
      }
      parcalar.push({ dosya: dest, metin, words: r.words });
    }
  }
  let t = 0.8; const sahne = [], words = [], bufs = [Buffer.alloc(Math.round(t * SR) * 2)];
  for (const [i, p] of parcalar.entries()) {
    if (H.sahneler[i].bolum && i > 0) { bufs.push(Buffer.alloc(Math.round(1.6 * SR) * 2)); t += 1.6; }
    let b = await pcm(p.dosya, dir, i);
    let kay = 0, ws;
    if (p.words?.length) {
      const a = Math.max(0, Math.round((p.words[0].t - 0.05) * SR)) * 2, son = p.words.at(-1);
      b = b.subarray(a, Math.min(b.length, Math.round((son.t + son.d + 0.3) * SR) * 2)); kay = a / 2 / SR;
      ws = p.words.map((x) => ({ w: x.w, t: x.t - kay, d: x.d }));
    } else {
      // Chatterbox: baştaki/sondaki sessizliği at, kelimeleri süreye orantılı dağıt
      const esik = 400; let bas = 0, bit = b.length / 2 - 1;
      while (bas < bit && Math.abs(b.readInt16LE(bas * 2)) < esik) bas++;
      while (bit > bas && Math.abs(b.readInt16LE(bit * 2)) < esik) bit--;
      bas = Math.max(0, bas - Math.round(0.03 * SR)); bit = Math.min(b.length / 2, bit + Math.round(0.2 * SR));
      b = b.subarray(bas * 2, bit * 2);
      ws = proportionalWords(p.metin, b.length / 2 / SR - 0.15);
    }
    const d = b.length / 2 / SR;
    for (const x of ws) words.push({ w: x.w, t: +(t + x.t).toFixed(3), d: +x.d.toFixed(3), s: i });
    sahne.push({ t0: +t.toFixed(3), t1: +(t + d).toFixed(3) });
    const bos = i === parcalar.length - 1 ? (uzun ? 6 : 1) : 0.55;
    bufs.push(b, Buffer.alloc(Math.round(bos * SR) * 2)); t += d + bos;
  }
  const veri = Buffer.concat(bufs); const ham = path.join(dir, 'anlatim.wav');
  fs.writeFileSync(ham, Buffer.concat([wavBasligi(veri.length), veri]));
  const dosya = await parcaSeviyesi(ham, -18);
  return { dosya, sure: +t.toFixed(2), sahne, words };
}

const srtZaman = (x) => new Date(Math.round(x * 1000)).toISOString().slice(11, 23).replace('.', ',');
function srtOf(words, sinir) {
  const cues = []; let cur = [];
  for (const w of words) { if (cur.length && (cur.at(-1).s !== w.s || cur.map((x) => x.w).join(' ').length + w.w.length > sinir)) { cues.push(cur); cur = []; } cur.push(w); }
  if (cur.length) cues.push(cur);
  return cues.map((q, i) => `${i + 1}\n${srtZaman(q[0].t)} --> ${srtZaman(q.at(-1).t + q.at(-1).d)}\n${q.map((x) => x.w).join(' ')}\n`).join('\n');
}
const tz = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export async function buildMasal(job, settings, { workDir }) {
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });
  const dil = settings.language, H = job.hikaye, dikey = job.type === 'short';
  console.log(`  seslendirme (${settings.voiceSource === 'klon' ? 'kendi ses, Chatterbox' : 'ElevenLabs'}) ${H.sahneler.length} sahne…`);
  const s = await seslendir(job, settings, dir);
  sfxHazirla(path.join(DIR, 'public', 'sfx'));
  const pub = path.join(DIR, 'public', job.id);
  fs.mkdirSync(pub, { recursive: true });
  try {
    fs.copyFileSync(s.dosya, path.join(pub, 'anlatim.wav'));
    const [width, height] = dikey ? [1080, 1920] : [1920, 1080];
    const props = {
      fps: FPS, width, height, durationInFrames: Math.ceil((dikey ? s.sure + 1.5 : s.sure + 5) * FPS),
      veri: { dil, sure: s.sure, sahne: s.sahne, words: s.words }, hikaye: H, ses: `${job.id}/anlatim.wav`, dikey: dikey ? 1 : 0,
    };
    const propsFile = path.join(dir, 'masal-props.json');
    fs.writeFileSync(propsFile, JSON.stringify(props));
    const ham = path.join(dir, 'masal.mp4');
    const bas = Date.now();
    await remotionCli(['render', 'src/index.jsx', 'Masal', ham, `--props=${propsFile}`, '--codec=h264', '--crf=20']);
    console.log(`  çizim: ${Math.round((Date.now() - bas) / 1000)} sn (${props.durationInFrames} kare)`);
    const ses = await sesSeviyesi(ham, path.join(dir, 'masal-ses.mp4'));
    if (ses.hata) throw new Error(`ses seviyesi: ${ses.hata}`);
    console.log(`  ses: ${ses.lufs} LUFS, tepe ${ses.tepe} dBTP`);
    let thumbnailPath = null;
    if (!dikey && H.kapak) {
      const kp = path.join(dir, 'kapak-props.json'), png = path.join(dir, 'kapak.png'), jpg = path.join(dir, 'kapak.jpg');
      fs.writeFileSync(kp, JSON.stringify({ hikaye: H, dil, dikey: 0 }));
      await remotionCli(['still', 'src/index.jsx', 'MasalKapak', png, `--props=${kp}`]);
      await run('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '3', jpg]);
      thumbnailPath = jpg;
    }
    // YouTube bölümleri: ilki 00:00 (soru), sonra her "bolum" sahnesi
    let bolumlerMetni = null;
    if (!dikey) {
      const b = [[0, H.giris?.[dil] ?? (dil === 'tr' ? 'Başlangıç' : 'Intro')], ...H.sahneler.map((x, i) => (x.bolum ? [Math.max(0, s.sahne[i].t0 - 1.6), String(x.bolum[dil]).replace(/^\d+\.\s*/, '')] : null)).filter(Boolean)];
      if (b.length >= 3) bolumlerMetni = b.map(([t, a]) => `${tz(t)} ${a}`).join('\n');
    }
    const credits = masalMuzikleri(H).map((m) => `"${MUZIK_AD[m] ?? m}" Kevin MacLeod (incompetech.com), Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/`);
    return { videoPath: ses.dosya, thumbnailPath, duration: props.durationInFrames / FPS, credits, srt: srtOf(s.words, dikey ? 32 : 42), bolumlerMetni, sahneZaman: s.sahne.map((x) => Math.round(x.t0 * 10) / 10) };
  } finally {
    fs.rmSync(pub, { recursive: true, force: true });
  }
}
