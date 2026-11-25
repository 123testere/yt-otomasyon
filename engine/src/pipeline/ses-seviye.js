// Master v4 O8: miks toplamda yaklaşık -14 LUFS, tepe -1 dBTP. İki geçişli loudnorm (ölç → uygula), sonra doğrula.
// Görüntü kopyalanır (yeniden kodlanmaz), yalnız ses yeniden kodlanır.
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { V4 } from '../lib/master-v4.js';

const sh = promisify(execFile);

async function olc(dosya, ekFiltre = '') {
  const filtre = `${ekFiltre}${ekFiltre ? ',' : ''}loudnorm=I=${V4.lufs}:TP=${V4.tepeDbtp}:LRA=11:print_format=json`;
  const { stderr } = await sh('ffmpeg', ['-hide_banner', '-nostats', '-i', dosya, '-vn', '-af', filtre, '-c:a', 'pcm_s16le', '-f', 'null', '-'], { maxBuffer: 64 * 1024 * 1024 });
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// Tek parçayı (anlatım, müzik) hedef LUFS'a getirir: sabit kazanç, tepe -1,5 dBTP'yi geçmez. Olmazsa dosya olduğu gibi kalır.
export async function parcaSeviyesi(dosya, lufs) {
  try {
    const m = await olc(dosya);
    const kazanc = Math.min(lufs - Number(m.input_i), -1.5 - Number(m.input_tp));
    if (!Number.isFinite(kazanc) || Math.abs(kazanc) < 0.3) return dosya;
    const cikti = dosya.replace(/\.[^.]+$/, '-esit.wav');
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', dosya, '-vn', '-af', `volume=${kazanc.toFixed(2)}dB`, '-ar', '48000', '-ac', '2', cikti]);
    console.log(`  ses dengesi: ${dosya.split(/[\\/]/).pop()} ${m.input_i} LUFS, kazanç ${kazanc.toFixed(1)} dB`);
    return cikti;
  } catch (e) {
    console.warn(`  ses dengelenemedi: ${String(e.message).slice(-150)}`);
    return dosya;
  }
}

export async function sesSeviyesi(girdi, cikti) {
  const m = await olc(girdi);
  const filtre = `loudnorm=I=${V4.lufs}:TP=${V4.tepeDbtp}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await sh('ffmpeg', ['-y', '-v', 'error', '-i', girdi, '-c:v', 'copy', '-af', filtre, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', cikti], { maxBuffer: 64 * 1024 * 1024 });
  let s = await olc(cikti);
  // loudnorm 'dynamic' kipe düşerse sessiz anlarda arka planı yükseltir: sabit kazanç + tepe sınırlayıcı kullan
  if (Number(m.input_tp) + V4.lufs - Number(m.input_i) > V4.tepeDbtp || Number(m.input_lra) > 11 || Number(s.input_tp) > V4.tepeDbtp) {
    const yedek = cikti.replace(/(\.[^.]+)$/, '-sinirli$1');
    const sinirli = async (kazanc) => {
      await sh('ffmpeg', ['-y', '-v', 'error', '-i', girdi, '-c:v', 'copy', '-af', `volume=${kazanc.toFixed(2)}dB,aresample=192000,alimiter=limit=0.8:attack=5:release=60:level=disabled,aresample=48000`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', yedek], { maxBuffer: 64 * 1024 * 1024 });
      return olc(yedek);
    };
    try {
      let k = V4.lufs - Number(m.input_i);
      let r = await sinirli(k);
      if (Math.abs(Number(r.input_i) - V4.lufs) > 0.4) { k += V4.lufs - Number(r.input_i); r = await sinirli(k); }
      if (Math.abs(Number(r.input_i) - V4.lufs) <= 1.5) { fs.renameSync(yedek, cikti); s = r; }
    } catch (e) {
      console.warn(`  sınırlayıcı çalışmadı, loudnorm sonucu kullanılıyor: ${String(e.message).slice(-150)}`);
    }
  }
  const lufs = Number(s.input_i);
  const tepe = Number(s.input_tp);
  // Kapı: hedefin ±1,5 LU içinde ve tepe -1 dBTP'yi (0,3 pay ile) geçmemeli
  const hata = Math.abs(lufs - V4.lufs) > 1.5 ? `ses ${lufs} LUFS (hedef ${V4.lufs})`
    : tepe > V4.tepeDbtp + 0.3 ? `tepe ${tepe} dBTP (en fazla ${V4.tepeDbtp})` : null;
  return { dosya: cikti, lufs, tepe, hata };
}
