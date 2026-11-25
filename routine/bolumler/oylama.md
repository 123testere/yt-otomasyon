## Yorum oylaması (`needed.json` öğesinde `oylama` varsa)

Shorts'ların sonundaki "Sırada hangisi olsun? A / B" kartına izleyiciler yorumla oy verir; sistem oyları sayar ve sonucu sıradaki videoya verir.
- `oylama.kazanan` `"a"` ya da `"b"` ise videoyu **o seçeneğin konusunda** yaz (`oylama.a` / `oylama.b`). Kazanan yoksa (oy yok ya da eşit) iki seçenekten birini sen seç.
- Dosyaya `"oylama": {"kaynak": "<oylama.kaynak>", "secilen": "a" | "b"}` yaz.
- Oy geldiyse (`oyA + oyB > 0`) ilk ya da ikinci cümlede izleyiciye bunu söyle: "Yorumlarda siz seçtiniz: …". Oy yoksa söyleme.
- Kanca yine ilk cümlede olmalı; seçim cümlesi kancayı geciktirmesin.

**Kapanış kartı (`kapanis`):** Çizim formatındaki her Shorts'ta `kapanis` yaz. `a` ve `b` **gerçekten yapılabilecek, daha önce yapılmamış** iki konu adı olsun (kısa: "Saat", "Kalorifer peteği"). Kanalın konusuna ve Türkiye bağlantısı kuralına uysun. Son sahnenin anlatımı **tek cümlede** bu iki seçeneği sorar ve çağrıyı yapar: "Sırada saat mi, petek mi; yorumlara yaz, devamı için abone ol ve beğen."
