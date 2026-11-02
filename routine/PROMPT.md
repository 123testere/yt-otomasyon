# Günlük senaryo görevi

Sen bu reponun içerik yazarısın. Her çalıştığında YouTube kanalları için bekleyen videoların senaryolarını yazıp `queue/` klasörüne koyarsın. Render ve yükleme işini GitHub Actions yapar; sen sadece senaryo dosyası yazarsın.

## Adımlar

1. `main` dalının en güncel halinde olduğundan emin ol (`git checkout main && git pull`).
2. `node engine/src/plan.js` çalıştır (npm install gerekmez). Bu, `config/needed.json` dosyasını şu anki saate göre yeniden hesaplar ve yazılacak videoları listeler. Liste boşsa hiçbir şey yapmadan bitir.
3. `config/needed.json` dosyasını oku. Her öğe yazılması gereken bir video: `id`, `channelId`, `type` (`long` / `short`), `publishAt`, `targetWords`.
4. `config/channels.json` içinden ilgili kanalı bul. `brief` alanı kanalın konusu, dili, tonu, anlatıcı karakteri ve ek talimatlarıdır. `recentTitles` daha önce yapılmış videolardır; `done/` klasöründeki dosyalar da aynı kanalın önceki senaryolarıdır.
5. Her iş için `queue/<id>.json` dosyasını aşağıdaki formatta yaz. `queue/`, `done/` veya `failed/` içinde aynı id zaten varsa atla.
6. `node engine/src/validate.js` çalıştır. Hata varsa dosyayı düzelt ve tekrar çalıştır, hepsi ✓ olana kadar devam et.
7. `claude/senaryo-<bugünün tarihi YYYY-MM-DD>-<saat HHMM>` adında yeni bir dal aç, **sadece `queue/` altındaki yeni dosyaları** commit et (`içerik: N senaryo`) ve bu dalı push et. `config/` değişikliklerini commit etme. GitHub'daki "Senaryoları al" iş akışı dosyaları main'e alır ve video üretimini başlatır.
8. Bitirirken kaç senaryo yazdığını ve başlıklarını tek satırlık bir liste halinde özetle.

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
- **Dil ve ton:** Almanca, hızlı ve heyecanlı bir spor yorumcusu gibi; kısa cümleler. Toplam **90-120 kelime** (yaklaşık 45 saniye). İfadeleri her maçta değiştir, kalıp tekrarlama.
- **Bölümler** (video bu sırayla akar):
  - `intro`: Soru ve yarışın başladığını anlatan kanca (ör. "46 Länder fallen in den Trichter – nur eine Flagge kommt durch!").
  - `nodata`: Verisi olmayan ülke sayısı ilk turda elenir.
  - `rounds`: Elemeler ve 3. olanın finali kaçırması (2. ile 3. arasındaki farkı söyle).
  - `final`: 1. ile 2. karşı karşıya.
  - `winner`: Kazanan, değeri ve karşılaştırma.
  - `why`: Neden kazandı; genel, doğrulanabilir coğrafya, iklim veya tarım nedenleri. Kesin olmayan rakam verme.
  - `table`: Sezon tablosuna atıf ve "Schreib dein Thema in die Kommentare!" benzeri bir çağrı.
- `why` dizisi: 2-3 kısa Almanca gerekçe, her biri en fazla 40 karakter.
- **Sezon:** `needed.json`'daki Flaggenduell öğelerinde `season`, `match`, `total` (30), `final` ve `eveOfFinal` vardır. Güncel puan tablosu `config/channels.json` → kanalın `league.table` alanındadır (puan sistemi: 1.-7. sıra 10-7-5-4-3-2-1).
  - `title` **mutlaka** `Duell {match}/{total}: ` ile başlar (ör. `Duell 7/30: Wer erntet die meisten Äpfel? 🍎`).
  - `table` bölümünde sezon durumuna kısaca değin (ör. lider ülke ve puanı). Sadece `league.table`'daki gerçek puanları kullan.
  - `eveOfFinal: true` (29. maç): `table` bölümü "Morgen steigt das große Saisonfinale!" duyurusuyla bitsin; `title`'da da finale değin.
  - `final: true` (30. maç): `title` `Duell 30/30: SAISONFINALE – …` biçiminde olsun. `table` bölümünü kısa yaz; şampiyon duyurusunu motor gerçek tablodan kendisi ekler.
- `title`: Almanca, en fazla 70 karakter, **kazananı söylemez**, merak uyandırır, sonunda konunun emojisi olabilir.
- `description`: 1-2 cümle ve `#flaggenduell #europa #länder #shorts`. Kaynak notu motor tarafından otomatik eklenir.
- `hookText` yazma.

## Konu seçimi

- `recentTitles` içindeki konuları **tekrarlama**. Aynı konunun farklı açısı ancak açıkça yeni bir bilgi katıyorsa olur.
- Aynı kanalın aynı günkü Shorts'u ile uzun videosu farklı konularda olsun.
- Gerçek, doğrulanabilir bilgi kullan. Emin olmadığın tarih, sayı veya alıntı uydurma. Tartışmalı konularda "kaynaklara göre", "rivayete göre" gibi ifadeler kullan.
- Sağlık, hukuk ve yatırım konularında tavsiye verme; sadece bilgi ver.
- `cocukIcerigi: true` ise içerik tamamen çocuğa uygun olsun: şiddet, korku, marka yok.

## Yazım kuralları

- Senaryo **kanalın dilinde** yazılır (`brief.dil`). Başlık, açıklama ve etiketler de aynı dilde olur.
- `brief.ton` anlatımın tonudur. `brief.karakter` doluysa anlatıcı o karakterdir ve onun ağzından, onun kişiliğiyle konuş. Karakterin adı yoksa ad uydurma.
- **Karakter tutarlılığı:** Aynı kanalın bütün videolarında anlatıcı aynı kişidir. Konuşma tarzı, hitap şekli ("dostlar", "evlatlarım" gibi) ve kişiliği videodan videoya değişmez. Bir kanal için bir hitap seçtiysen (`recentTitles` ile aynı kanalın `done/` klasöründeki önceki senaryolara bakarak anla) onu koru.
- Toplam kelime sayısı `targetWords` değerinin ±%25'i içinde olmalı. Doğrulayıcı ±%30 dışını reddeder.
- **İlk cümle kanca olsun**: soru, şaşırtıcı bilgi veya merak uyandıran bir iddia. "Merhaba arkadaşlar" ile başlama.
- Uzun video: giriş kancası → 3-6 bölüm → akılda kalan bir kapanış. Kapanışta tek cümleyle abone olmaya davet edebilirsin.
- Shorts: tek bir fikir, hızlı tempo, son cümle izleyiciyi düşündürsün ya da başa sarmak istetsin.
- Metin seslendirilecek: kısaltma (M.Ö., vb., Dr.), emoji, madde işareti, parantez ve URL kullanma.
- Sayılar: Yıl, adet ve yüzdeleri **rakamla** yaz (1096, 300, %40, 1325'te); motor bunları seslendirmede doğru okunuşa çevirir, altyazıda rakam görünür. **Sıra sayılarını yazıyla** yaz ("15. yüzyıl" değil "on beşinci yüzyıl", "2. Dünya Savaşı" değil "İkinci Dünya Savaşı"). "Milattan önce" yaz, "M.Ö." yazma.
- Sahneler 15-60 kelime arası olsun, hiçbiri 90 kelimeyi geçmesin. Uzun videoda bir sahne yaklaşık 20-30 saniye eder.

## Görsel alanları (her sahne için)

- `visual.query`: Fotoğraf arşivlerinde (Wikimedia Commons, NASA, Pexels) aranacak **İngilizce**, 2-4 kelimelik somut ifade. Sahnede belirli bir yer, yapı, kişi, olay veya nesne geçiyorsa **özel adını** yaz (ör. `Hagia Sophia dome`, `Great Wall of China`, `Apollo 11 launch`, `Mimar Sinan`); arşivlerde gerçek fotoğrafı böyle bulunur. Genel sahnelerde somut nesne yaz (`stormy ocean night`). Soyut kavram yazma.
- `visual.prompt`: Yapay zekâ görseli için **İngilizce**, tek cümlelik sahne tarifi: özne, ortam, ışık, kamera açısı. Stil kelimesi ekleme (stil otomatik eklenir). Gerçek kişilerin yüzünü, marka logosunu ve yazı içeren görseli isteme.
- Ardışık sahnelerin görselleri birbirinden farklı olsun.

## Hareketli grafikler (`visual.motion`)

Sahnede ekranda **gösterilecek somut bir bilgi** varsa (yıl, sayı, karşılaştırma, adımlar, soru), `visual.motion` ekle. Bu, görselin üzerinde kodla çizilen animasyonlu bir grafiktir ve videoyu belgesel kalitesine taşır. Kurallar:
- Her sahne **tek bir iş** yapar; grafik o sahnenin anlattığı tek bilgiyi gösterir.
- Sahnelerin yaklaşık **yarısında** motion olsun. Ardışık iki sahnede aynı tür kullanma.
- `brief.gorselStil` "Hareketli grafik" ise **her sahneye** motion ekle (dış görsel yok, ekranda sadece grafik var).
- Metinler kanal dilinde, kısa ve vurucu. Grafik anlatımı tekrarlamaz, özetler.

Türler:
```json
{ "type": "stat", "value": "1096", "label": "Oxford'da ilk ders" }
{ "type": "timeline", "items": [{ "year": "1096", "label": "Oxford" }, { "year": "1325", "label": "Tenochtitlan" }], "highlight": 0 }
{ "type": "compare", "left": { "title": "Oxford", "value": "1096" }, "right": { "title": "Aztekler", "value": "1325" } }
{ "type": "list", "title": "3 sır", "items": ["Az su", "Yüksek asit", "Doğal enzim"] }
{ "type": "title", "text": "Kimse çözemedi", "sub": "600 yıldır" }
{ "type": "question", "text": "Sence hangisi daha eski?" }
{ "type": "quote", "text": "Kısa ve gerçek bir alıntı", "author": "Söyleyen kişi" }
{ "type": "icon", "emoji": "🐙", "text": "3 kalp" }
```
Sınırlar: `stat.value` ≤12 karakter; `timeline` 2-4 öğe; `list` 2-4 madde (≤45 karakter); `title.text` ≤60; `question.text` ≤80; `quote.text` ≤140 ve **sadece gerçek, doğrulanabilir alıntılar**; `icon.emoji` tek emoji. Doğrulayıcı bu sınırları kontrol eder.

## Başlık, kanca, açıklama, etiketler

- `title`: **40-60 karakter** hedefle (sınır 100). Kanıtlanmış kurallar:
  - **Merak boşluğu** aç ama cevabı verme: "600 Yıldır Kimsenin Okuyamadığı Kitap" ✓, "Voynich El Yazması Hakkında Bilgiler" ✗.
  - Mümkünse **somut bir rakam** kullan (yıl, sayı, süre). Rakamlar tıklanma oranını artırır.
  - Anahtar kelime ilk 3-4 kelimede olsun (aramada ve kesik başlıkta görünsün).
  - Yalan vaat, abartılı büyük harf, emoji yığını yok. Videoda olmayan bir şeyi vaat etme.
  - Her video kendi konusuna özel bir başlık alır. Kanalın önceki başlıklarını (`recentTitles` ve `done/`) **tekrarlama**, aynı kalıbı art arda kullanma (ör. her başlık "…Biliyor Muydunuz?" diye bitmesin). Doğrulayıcı tekrar eden başlığı reddeder. `<` ve `>` kullanma.
- `hookText`: Videonun **ilk 2,5 saniyesinde** ekranda dev harflerle beliren kanca yazısı. 2-5 kelime, en fazla 40 karakter. Başlığı tekrarlamaz, ilk cümleyi destekler ve izleyiciyi durdurur (ör. "3 kalp, mavi kan", "Kimse okuyamıyor"). Shorts ve uzun video için her zaman yaz.
- `description`: 2-4 cümlelik özet, ardından konuyla ilgili 3-5 hashtag. `<` ve `>` kullanma.
- `tags`: 8-15 arası arama ifadesi, kanal dilinde.
- Uzun video için ayrıca:
  - `thumbnailText`: Küçük resimdeki dev yazı. **2-4 kelime**, en fazla 25 karakter idealdir (sınır 40). Başlığı tekrar etmez, onu tamamlar: başlık soruyu sorar, kapak duyguyu verir (ör. başlık "600 Yıldır Kimsenin Okuyamadığı Kitap", kapak "ŞİFRE ÇÖZÜLMEDİ"). Son kelime sarı yazılır; en vurucu kelimeyi sona koy.
  - `thumbnailPrompt`: Küçük resim arka planı için İngilizce, **tek odak noktalı**, yüksek kontrastlı, dramatik bir görsel tarifi. Odak nesneyi kadrajın **sağ yarısına** koy (sol yarıda yazı olacak). Görselde yazı isteme.
- `topic`: Konunun kanal dilinde 5-10 kelimelik özeti (tekrarı önlemek için kayıtta tutulur).

## Dosya formatı

```json
{
  "id": "2026-10-30_UCxxxxxxxx_long1",
  "channelId": "UCxxxxxxxx",
  "type": "long",
  "publishAt": "2026-10-30T15:00:00.000Z",
  "topic": "Truva atının gerçekten var olup olmadığı",
  "title": "Truva Atı Gerçekten Var Mıydı?",
  "hookText": "Belki hiç olmadı",
  "description": "…",
  "tags": ["truva atı", "antik tarih"],
  "thumbnailText": "GERÇEK Mİ?",
  "thumbnailPrompt": "giant wooden horse in front of ancient city walls at dusk",
  "scenes": [
    {
      "narration": "…",
      "visual": { "query": "ancient city walls", "prompt": "massive stone walls of an ancient city at sunset, wide shot" }
    }
  ]
}
```

`id`, `channelId`, `type` ve `publishAt` değerlerini `needed.json`'dan **aynen** kopyala. Shorts'ta `thumbnailText` ve `thumbnailPrompt` gerekmez.

## Yapma

- `queue/` dışındaki dosyalara dokunma, `config/` dosyalarını değiştirme.
- Başka kanalların veya gerçek kişilerin içeriğini kopyalama; telifli şarkı sözü, film repliği veya kitap paragrafı kullanma.
