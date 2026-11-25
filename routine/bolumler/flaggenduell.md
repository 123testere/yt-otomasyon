## Flaggenduell kanalları (`brief.format` = `"flaggenduell"`)

Bu kanallar belgesel değil, **veriyle ülke yarışı** yayınlar. Video kodla çizilir; sen sadece konuyu seçip Almanca anlatımı yazarsın. Aşağıdaki "Konu seçimi", "Yazım kuralları", "Görsel alanları" ve "Hareketli grafikler" bölümleri bu kanallar için **geçerli değildir**; `scenes` yazma.

Dosya formatı:
```json
{
  "id": "…", "channelId": "…", "type": "short", "format": "duell", "publishAt": "…",
  "topic": "Kirschen",
  "title": "Wer erntet die meisten Kirschen in Europa? 🍒",
  "description": "46 Länder, echte Daten, nur eine Flagge kommt durch. Wer gewinnt?\n\n#flaggenduell #europa #länder #shorts",
  "tags": ["flaggenduell", "europa", "länder vergleich", "kirschen"],
  "duell": {
    "topicId": "kirschen",
    "why": ["Kalte Winter", "Heiße, trockene Sommer", "Riesige Anbauflächen"],
    "script": { "intro": "…", "nodata": "…", "rounds": "…", "final": "…", "winner": "…", "why": "…", "table": "…" }
  }
}
```

Kurallar:
- **Konu:** `config/duell-standings.json` içindeki konulardan, bu kanalın `done/` ve `queue/` dosyalarında `duell.topicId` olarak **hiç kullanılmamış** birini seç. Kazananlar çeşitlensin: Türkiye çok kazanıyor, araya Almanya, Fransa, İspanya, İtalya, Ukrayna, Polonya, Sırbistan kazanan konuları serpiştir. Aynı ülke art arda iki maç kazanmasın.
- **Sayılar:** SADECE `duell-standings.json`'daki değerleri kullan: `top` listesi (Almanca ülke adları ve ton), `noData`, `countries`. Asla tahmin etme. Yuvarlarken "über", "knapp", "rund" de. Oran veya fark hesaplarsan doğru hesapla (ör. 726.500 / 124.010 ≈ 5,9 → "fast sechsmal so viel").
- **Okunuş güvenliği:** Büyük sayıları "726 Tausend", "4,4 Millionen", "knapp 3000" gibi yaz; binlik ayırıcı nokta kullanma.
- **Dil ve ton:** Almanca, hızlı ve heyecanlı bir spor yorumcusu gibi; kısa cümleler. Toplam **60-90 kelime** (hızlı Shorts: her bölüm tek kısa cümle, yaklaşık 30 saniye). İfadeleri her maçta değiştir, kalıp tekrarlama.
- **Bölümler** (video bu sırayla akar):
  - `intro`: Soru ve yarışın başladığını anlatan kanca (ör. "46 Länder fallen in den Trichter – nur eine Flagge kommt durch!").
  - `nodata`: Verisi olmayan ülke sayısı ilk turda elenir.
  - `rounds`: Elemeler ve 3. olanın finali kaçırması (2. ile 3. arasındaki farkı söyle).
  - `final`: 1. ile 2. karşı karşıya.
  - `winner`: Kazanan, değeri ve karşılaştırma.
  - `why`: Neden kazandı; genel, doğrulanabilir coğrafya, iklim veya tarım nedenleri. Kesin olmayan rakam verme.
  - `table`: Sezon tablosuna tek cümlelik atıf ve **abone + beğen çağrısı** (zorunlu): "Abonniere und like für das nächste Duell – und schreib dein Thema in die Kommentare!" benzeri.
- `why` dizisi: 2-3 kısa Almanca gerekçe, her biri en fazla 40 karakter.
- **Sezon:** `needed.json`'daki Flaggenduell öğelerinde `season`, `match`, `total` (30), `final` ve `eveOfFinal` vardır. Güncel puan tablosu `config/channels.json` → kanalın `league.table` alanındadır (puan sistemi: 1.-7. sıra 10-7-5-4-3-2-1).
  - `title` **mutlaka** `Duell {match}/{total}: ` ile başlar (ör. `Duell 7/30: Wer erntet die meisten Äpfel? 🍎`).
  - `table` bölümünde sezon durumuna kısaca değin (ör. lider ülke ve puanı). Sadece `league.table`'daki gerçek puanları kullan.
  - `eveOfFinal: true` (29. maç): `table` bölümü "Morgen steigt das große Saisonfinale!" duyurusuyla bitsin; `title`'da da finale değin.
  - `final: true` (30. maç): `title` `Duell 30/30: SAISONFINALE – …` biçiminde olsun. `table` bölümünü kısa yaz; şampiyon duyurusunu motor gerçek tablodan kendisi ekler.
- `title`: Almanca, en fazla 70 karakter, **kazananı söylemez**, merak uyandırır, sonunda konunun emojisi olabilir.
- `description`: 1-2 cümle ve `#flaggenduell #europa #länder #shorts`. Kaynak notu motor tarafından otomatik eklenir.
- `hookText` yazma.
