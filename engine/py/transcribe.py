# Yayın kesitindeki konuşmayı kelime zamanlarıyla yazıya döker (faster-whisper, ücretsiz, CPU).
# Ses ffmpeg ile çözülür (PyAV sürüm uyumsuzluklarından bağımsız).
# Kullanım: python transcribe.py <ses/video> <çıktı.json> [model=small.en]
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small.en", device="cpu", compute_type="int8")
segments, _ = model.transcribe(audio, word_timestamps=True, vad_filter=True, language="en")
words = [{"t": round(w.start, 3), "d": round(max(0.05, w.end - w.start), 3), "w": w.word.strip()}
         for s in segments for w in (s.words or []) if w.word.strip()]
json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(words)} kelime")
