// Kanalın klon ses örneğini yönetir.
//   node src/voice.js yukle <kanalId> <dosya.mp3>   → bilgisayardan Firestore'a
//   node src/voice.js indir <kanalId> <hedef.mp3>   → Firestore'dan dosyaya (GitHub Actions)
import { downloadVoiceSample, uploadVoiceSample } from './lib/voice.js';

const [cmd, channelId, file] = process.argv.slice(2);
if (!['yukle', 'indir'].includes(cmd) || !channelId || !file) {
  console.error('Kullanım: node src/voice.js yukle|indir <kanalId> <dosya>');
  process.exit(1);
}

try {
  if (cmd === 'yukle') {
    const bytes = await uploadVoiceSample(channelId, file);
    console.log(`✓ Ses örneği yüklendi (${Math.round(bytes / 1024)} KB).`);
  } else {
    await downloadVoiceSample(channelId, file);
    console.log('✓ Ses örneği indirildi.');
  }
  process.exit(0);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
