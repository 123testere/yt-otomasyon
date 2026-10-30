"""Chatterbox Multilingual ile örnek sesten klonlanmış seslendirme üretir (CPU).

Kullanım: python clone_tts.py <ornek-ses.wav> <dil> <metinler.json> <cikti-klasoru> [ayarlar-json]
metinler.json: ["birinci sahne metni", "ikinci sahne metni", ...]
ayarlar-json: '{"exaggeration": 0.5, "cfg_weight": 0.5}' (uygulamadaki "Ses ifadesi")
Her metin için <cikti-klasoru>/000.wav, 001.wav ... yazar; ilerlemeyi satır satır JSON basar.
"""
import json
import sys
import time

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main(ref, lang, texts_file, out_dir, params_json="{}"):
    params = json.loads(params_json)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    started = time.time()
    try:
        model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
    except TypeError:
        # PyPI sürümü t3_model parametresini tanımıyorsa varsayılan çok dilli modele düş.
        model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    print(json.dumps({"event": "model_loaded", "took": round(time.time() - started, 1)}), flush=True)

    with open(texts_file, encoding="utf-8") as f:
        texts = json.load(f)
    for i, text in enumerate(texts):
        t0 = time.time()
        wav = model.generate(text, language_id=lang, audio_prompt_path=ref, **params)
        ta.save(f"{out_dir}/{i:03d}.wav", wav, model.sr)
        print(json.dumps({
            "event": "scene", "i": i,
            "audio_sec": round(wav.shape[-1] / model.sr, 2),
            "took": round(time.time() - t0, 1),
        }), flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:6])
