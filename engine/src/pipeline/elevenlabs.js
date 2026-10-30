// ElevenLabs ile seslendirme (kanal sahibinin kendi klon sesi). Harf harf zaman damgası döndüğü için
// kelime kelime altyazı sesle birebir eşleşir. Ücretlidir: kredi karakter başına harcanır.
import fs from 'node:fs/promises';

const API = 'https://api.elevenlabs.io/v1';
// İlk desteklenen model kullanılır; hesapta olmayan/kalkan model 400/422 döner ve sıradakine geçilir.
const MODELS = [...new Set([process.env.ELEVENLABS_MODEL, 'eleven_v4', 'eleven_v3', 'eleven_multilingual_v2'].filter(Boolean))];

let workingModel = null;

// Harf zamanlarını kelimelere çevirir: boşlukla ayrılan her parça bir kelime.
function charsToWords(alignment) {
  const { characters = [], character_start_times_seconds: starts = [], character_end_times_seconds: ends = [] } = alignment ?? {};
  const words = [];
  let cur = null;
  characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { t: starts[i], end: ends[i], w: '' };
    cur.w += ch;
    cur.end = ends[i];
  });
  if (cur) words.push(cur);
  return words.map(({ t, end, w }) => ({ t, d: Math.max(0.05, end - t), w }));
}

export async function elevenScene(text, { voiceId, speed = 1 }, dest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY tanımlı değil');
  if (!voiceId) throw new Error('ElevenLabs ses kimliği girilmemiş');

  let lastError;
  for (const model of workingModel ? [workingModel] : MODELS) {
    const res = await fetch(`${API}/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      // Hız sadece değiştiyse gönderilir; bazı modeller bu ayarı tanımayıp isteği reddedebilir.
      body: JSON.stringify({
        text, model_id: model,
        ...(speed !== 1 ? { voice_settings: { speed: Math.min(1.2, Math.max(0.7, speed)) } } : {}),
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (res.status === 400 || res.status === 422) {
      lastError = new Error(`ElevenLabs ${model} reddetti: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    if (!res.ok) {
      const hint = res.status === 401 ? ' (API anahtarı geçersiz)' : res.status === 402 || res.status === 429 ? ' (kredi/kota bitti)' : '';
      throw new Error(`ElevenLabs HTTP ${res.status}${hint}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    await fs.writeFile(dest, Buffer.from(data.audio_base64, 'base64'));
    workingModel = model;
    return { raw: dest, words: charsToWords(data.alignment ?? data.normalized_alignment) };
  }
  throw lastError ?? new Error('ElevenLabs modeli bulunamadı');
}
