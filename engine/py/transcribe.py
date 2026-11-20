# Yayın kesitindeki konuşmayı kelime zamanlarıyla yazıya döker (faster-whisper, ücretsiz, CPU).
# Kullanım: python transcribe.py <ses/video> <çıktı.json> [model=small.en]
import json, sys
from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small.en", device="cpu", compute_type="int8")
segments, _ = model.transcribe(src, word_timestamps=True, vad_filter=True, language="en")
words = [{"t": round(w.start, 3), "d": round(max(0.05, w.end - w.start), 3), "w": w.word.strip()}
         for s in segments for w in (s.words or []) if w.word.strip()]
json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(words)} kelime")
