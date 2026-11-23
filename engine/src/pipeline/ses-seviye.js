// Master v4 O8: miks toplamda yaklaşık -14 LUFS, tepe -1 dBTP. İki geçişli loudnorm (ölç → uygula), sonra doğrula.
// Görüntü kopyalanır (yeniden kodlanmaz), yalnız ses yeniden kodlanır.
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

export async function sesSeviyesi(girdi, cikti) {
  const m = await olc(girdi);
  const filtre = `loudnorm=I=${V4.lufs}:TP=${V4.tepeDbtp}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await sh('ffmpeg', ['-y', '-v', 'error', '-i', girdi, '-c:v', 'copy', '-af', filtre, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', cikti], { maxBuffer: 64 * 1024 * 1024 });
  const s = await olc(cikti);
  const lufs = Number(s.input_i);
  const tepe = Number(s.input_tp);
  // Kapı: hedefin ±1,5 LU içinde ve tepe -1 dBTP'yi (0,3 pay ile) geçmemeli
  const hata = Math.abs(lufs - V4.lufs) > 1.5 ? `ses ${lufs} LUFS (hedef ${V4.lufs})`
    : tepe > V4.tepeDbtp + 0.3 ? `tepe ${tepe} dBTP (en fazla ${V4.tepeDbtp})` : null;
  return { dosya: cikti, lufs, tepe, hata };
}
