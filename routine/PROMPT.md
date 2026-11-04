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

## Çizim formatı (`needed.json` öğesinde `"format": "cizim"` varsa)

Bu kanalın videoları stok görselle değil, **kodla mürekkep çizimiyle** yapılır (eski bir ansiklopedi sayfası; anlatıcı Nur Bey lambası ekranda kendiliğinden çizilir). Her sahnenin görüntüsünü sen `cizim` alanına JavaScript olarak yazarsın. Dosyaya `"format": "cizim"` yaz. Bu formatta `visual.motion` ve `thumbnailPrompt` kullanılmaz; `hookText` yerine `baslikKart` yazılır.

**Sahneler:** Her sahne **bir cümle** (en fazla iki kısa cümle) ve o cümleyi anlatan **tek bir çizim**. Shorts'ta 8-12 sahne, uzun videoda 60-120 sahne olur. Çizim cümlenin somut nesnesini gösterir (çay bardağı, simit, telefon, dükkân, harita, zaman çizgisi, kesit). Yazı sadece etiket ve tarih olarak kullanılır, cümleyi ekrana yazmak yasak (altyazı zaten var).

**Görsel (ara sıra):** Sadece gerçek bir fotoğraf ya da belge gerçekten gerekiyorsa (ör. mucidin portresi, tarihi bina), o sahnede `cizim` yerine `"visual": {"query": "…", "prompt": "…"}` yaz; arşivden bulunur ve kâğıda basılmış levha olarak gösterilir. Sahnelerin en fazla dörtte biri görsel olabilir; doğrulayıcı fazlasını reddeder.

**Çizim alanı:** 1000 × 700 (sol üst 0,0). Kenarlardan 40 piksel içeride kal. Yazılar en az 36 piksel. Çizim kodu bu değişkenleri ve fonksiyonları kullanabilir, başka hiçbir şey yok:
- `u`: sahnenin başından beri geçen saniye; `T`: videonun saniyesi. `W`, `H` (1000, 700), `MX`, `MY` (orta nokta).
- `K`: renkler: `K.m` mürekkep, `K.s` soluk, `K.ak` koyu amber (vurgu), `K.bordo`, `K.mavi` (etiket), `K.pirinc`, `K.yesil`, `K.kagit`, `K.kg`.
- `ink(noktalar, {close, fill, w, c, seed, pp, amp, dash})`: titreyen mürekkep çizgisi. `pp` 0→1 çizginin çizilerek belirmesi; `fill` dolgu rengi; her şekle farklı `seed` ver.
- `ell(cx, cy, rx, ry, n, a0, a1)` elips/yay noktaları · `ln([x1,y1], [x2,y2], n)` doğru · `kutu(x, y, w, h)` dikdörtgen.
- `txt(yazı, x, y, boyut, {c, a, al, w, it})` başlık/sayı · `etk(yazı, x, y, a, {size, c, al})` italik etiket.
- `ok([x1,y1], [x2,y2], {pp, c, w, seed})` ok · `cizgiEtiket(yazı, [nesneX,nesneY], [yazıX,yazıY], a, {al})` nesneye çizgiyle bağlı etiket.
- `eo(pr(u, başla, bitir))`: 0→1 yumuşak belirme (animasyonun temeli). `h(n)`: tohumlu rastgele sayı (0-1). `ctx`: tuval (save/restore, globalAlpha, translate, rotate, arc, fill).
- Yasak: `Math.random`, `Date`, `while`, `document`, `window`, `fetch`, `import`. Döngüler için `for` kullan. Her çizim en fazla 6000 karakter.

Öğeleri sırayla belirt (`pp: eo(pr(u, 0, .6))`, `a: eo(pr(u, .8, 1.3))`), sahne boyunca hareket olsun (`Math.sin(T * 3)` ile hafif salınım, akan noktalar). Renkli dolgu az: nesnenin kendi rengi (çay `#B5432F`, bal `#E8B64A`), gerisi kâğıt tonları (`#FBF6EA`, `#EFE4CB`, `#E6DBC4`).

Örnek (eski Shorts'tan, 1000x700 alanında):
```js
// Petek: kalorifer peteği ve yükselen sıcak hava
for (let i = 0; i < 7; i++) ink(kutu(260 + i * 70, 260, 56, 260), { close: true, fill: '#E9E3D6', w: 3.4, seed: 10 + i, pp: eo(pr(u, i * .1, .5 + i * .1)) });
for (let k = 0; k < 4; k++) { const ph = (T * .6 + k * .25) % 1, x = 300 + k * 110, q = [];
  for (let i = 0; i <= 12; i++) q.push([x + Math.sin(i * .9 + T * 3 + k) * 10, 240 - i * 10 - ph * 60]);
  ctx.save(); ctx.globalAlpha = (1 - ph) * .9; ink(q, { w: 3.4, c: K.lamba, amp: .3 }); ctx.restore(); }
etk('sıcak su', 200, 600, eo(pr(u, .4, 1)), { al: 'left' });
```
```js
// Zaman çizgisi: iki tarih
ink(ln([140, 380], [860, 380], 20), { w: 4, pp: eo(pr(u, 0, 1)) });
for (const [x, yil, ad, k] of [[300, '1841', 'Joseph Nason', 0], [700, '1857', 'Franz San Galli', 1]]) { const a = eo(pr(u, .4 + k * 1.2, 1 + k * 1.2));
  ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, 380, 18, 0, 7); ctx.fillStyle = k ? K.ak : K.s; ctx.fill(); ctx.restore();
  txt(yil, x, 320, 64, { a, c: k ? K.ak : K.s }); etk(ad, x, 460, a, { size: 40 }); }
```

**Diğer alanlar:**
- `ifade` (isteğe bağlı, her sahne): Nur Bey'in yüzü: `anlatiyor` (varsayılan), `merakli`, `saskin`, `gulumsuyor`, `kahkaha`, `dusunceli`, `endiseli`, `gururlu`. Cümlenin duygusuna göre seç.
- `baslikKart`: Shorts'ta üstte, uzun videoda girişte duran iki satırlık başlık (her satır ≤22 karakter); ikinci satır lamba renginde vurgulanır. Merak uyandıran soru: `["Simidin ortası", "neden delik?"]`.
- `kapanis` (Shorts, isteğe bağlı): Son sahnede çıkan seçmeli soru kartı: `{"soru": "Sırada hangisi olsun?", "a": "Saat", "b": "Petek"}` (a ve b ≤18, soru ≤30). Son sahnenin anlatımı bu soruyu sorar; son sahneye çizim olarak `txt('?', MX, 420, 200, { c: K.ak })` yeter.
- Uzun video: İlk sahneler **giriş**tir (gece zemininde, `baslikKart` başlığıyla). Her bölümün ilk sahnesine `"bolum": {"no": "Bölüm I", "ust": "1840'lar – 1870'ler", "ad": "Konuşamayan tel"}` yaz (ad ≤32). İlk sahnede `bolum` olmaz. 5-7 bölüm.
- Uzun video kapağı: `thumbnailText` (2-3 kelime, ilk satır lamba renginde: "22 YIL YASAK"), `kapakAlt` (isteğe bağlı küçük italik satır: "İstanbul · 1886–1908") ve `kapakCizim`: **300 × 420** alanında, kalın çizgili (`w: 8`) tek nesne (ör. üstü çizili telefon). Kapakta çizim kendiliğinden kâğıt renginde çizilir.

**Kesit Shorts'ta:** Kaynak uzun videonun sahnelerindeki `cizim` kodlarını aynen kopyalayabilirsin; alan ölçüsü aynıdır.

## Uzun videodan kesit Shorts (`needed.json` öğesinde `clipOf` varsa)

Bu Shorts bağımsız değildir; `clipOf` id'li uzun videonun bir bölümünden kurgulanır ve izleyiciyi uzun videoya çağırır.
- Kaynak senaryoyu `queue/<clipOf>.json` ya da `done/<clipOf>.json` içinde oku. Kaynak da bu turda yazılacaksa (`needed.json`'da) **önce onu yaz**.
- Aynı uzun videodan daha önce çıkmış kesitleri bul (`queue/` ve `done/` içinde `derivedFrom` değeri aynı olanlar) ve **farklı bir bölüm** seç: kendi başına anlaşılır, en çarpıcı bilgi ya da hikâye.
- Dosyaya `"derivedFrom": "<clipOf>"` yaz.
- Anlatım büyük ölçüde uzun videonun cümlelerinden gelir (doğrulayıcı kelimelerin en az %60'ının kaynakta geçmesini ister). Shorts'a uysun diye kısaltabilir, sırasını değiştirebilirsin.
- İlk cümle yeni bir kanca olabilir. Son cümle hikâyenin tamamının kanaldaki uzun videoda olduğunu söyler ve izleyiciye seçmeli bir soru sorar. Açıklamaya bağlantıyı motor ekler.
- Başlık kesite özgü ve yeni olsun, uzun videonun başlığını tekrar etme. `hookText` yaz.
- Görsel alanları ve hareketli grafikler normal kurallara göre yazılır; uzun videodaki uygun `visual.query` değerlerini yeniden kullanabilirsin.

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
- Sahneler 15-60 kelime arası olsun, hiçbiri 90 kelimeyi geçmesin. Uzun videoda bir sahne yaklaşık 20-30 saniye eder. (Çizim formatında her sahne bir cümledir; yukarıdaki bölüme bak.)

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
