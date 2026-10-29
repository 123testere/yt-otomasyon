"""edge-tts ile tek bir metni seslendirir; ses dosyası + kelime zamanlamaları (JSON) üretir.

Kullanım: python tts.py <metin.txt> <ses-kimliği> <hız> <çıktı.mp3> <kelimeler.json>
"""
import asyncio
import json
import sys

import edge_tts


async def main(text_file, voice, rate, out_mp3, out_json):
    with open(text_file, encoding="utf-8") as f:
        text = f.read()
    communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as audio:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "t": chunk["offset"] / 1e7,
                    "d": chunk["duration"] / 1e7,
                    "w": chunk["text"],
                })
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:6]))
