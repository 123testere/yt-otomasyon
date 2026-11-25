# Günlük senaryo görevi

Sen bu reponun içerik yazarısın. Her çalıştığında YouTube kanalları için bekleyen videoların senaryolarını yazıp `queue/` klasörüne koyarsın. Render ve yükleme işini GitHub Actions yapar; sen sadece senaryo dosyası yazarsın.

## Adımlar

1. `main` dalının en güncel halinde olduğundan emin ol (`git checkout main && git pull`).
2. `node engine/src/plan.js` çalıştır (npm install gerekmez). Bu, `config/needed.json` dosyasını şu anki saate göre yeniden hesaplar ve yazılacak videoları listeler. Ardından **`node engine/src/rutin-ozet.js`** çalıştır: bu gece okunacak talimat dosyalarını (`routine/bolumler/…`), yazılacak videoları ve yalnız ilgili kanalların bilgisini verir. **Token tasarrufu:** listelenen dosyaları birer kez oku; listede olmayan bölümü, `config/channels.json`, `needed.json` ve `performans.json` dosyalarının tamamını okuma. Performans verisi gerekince `node engine/src/rutin-ozet.js analiz`. Eski senaryoya biçim için bakacaksan kanal başına yalnız en yeni bir dosyaya bak. Yazılacak video yoksa yalnız listelenen analiz bölümlerini yap; onlar da yoksa bitir.
3. Özetteki her "Yazılacak video": `id`, `channelId`, `type` (`long` / `short`), `publishAt`, `targetWords`. `format` varsa (`duell`, `cizim`, `dizi`) o formatın `routine/bolumler/` dosyasına göre yaz.
4. Kanal bilgisi özettedir. `brief` alanı kanalın konusu, dili, tonu, anlatıcı karakteri ve ek talimatlarıdır. `sonBasliklar` daha önce yapılmış videolardır; `done/` klasöründeki dosyalar da aynı kanalın önceki senaryolarıdır.
5. Her iş için `queue/<id>.json` dosyasını aşağıdaki formatta yaz. `queue/`, `done/` veya `failed/` içinde aynı id zaten varsa atla.
6. `node engine/src/validate.js` çalıştır. Hata varsa dosyayı düzelt ve tekrar çalıştır, hepsi ✓ olana kadar devam et.
7. `claude/senaryo-<bugünün tarihi YYYY-MM-DD>-<saat HHMM>` adında yeni bir dal aç, **sadece `queue/`, `analiz/`, `cevaplar/`, `iyilestirme/`, `kesif/` altındaki ve `diziler/kesif-*.json` yeni dosyaları** commit et (`içerik: N senaryo`) ve bu dalı push et. `config/` değişikliklerini commit etme. GitHub'daki "Senaryoları al" iş akışı dosyaları main'e alır ve video üretimini başlatır.
8. Bitirirken kaç senaryo yazdığını ve başlıklarını tek satırlık bir liste halinde özetle.

## MASTER PROMPT v4 — EN ÜST KURAL (`needed.json` öğesinde `"masterV4": true`)

Kapsam: Lamba Altında, Burak kaan Gürer, Bölüm Bölüm, Kaan AI Lab (`config/master-v4.json`). Flaggenduell ve Vice City Dispatch muaf.
Bu kanallar için **önce `routine/MASTER-v4.md` dosyasını baştan sona oku**; bu dosyadaki çelişen her kuralı (hızlı Shorts kalıbı, 4-5 cümle,
zorunlu hızlandırma, döngü, seçmeli soru kartı, "her gün Shorts" vb.) geçersiz kılar. Tek kural karşılanmazsa doğrulayıcı işi reddeder ve video üretilmez.
Senaryoda zorunlu alanlar:
- `kaynaklar`: `[{ "url": "https://…", "not": "hangi bilgiyi doğruluyor" }]` — her tarih/sayı/isim açılan bir kaynakla (O3). Doğrulayamadığın bilgiyi yazma;
  yazmak zorundaysan `[DOĞRULANMALI]` ile işaretle (o video yayınlanmaz). Kurgu dizi bölümünde kaynak yerine `"kurgu": true`; kurgu gerçek olay gibi sunulmaz.
- `kontrol`: bölüm 6 listesindeki **her madde** için `"evet: nasıl"` (uzun: O1–O12, U1–U9, Y1–Y4; Shorts: O1–O12, S1–S6, Y1–Y4). Dürüst doldur; "evet" diyemiyorsan senaryoyu düzelt.
- `tags`: en fazla 6 alakalı etiket (O12).
- **Uzun:** `title` ≤ 50 karakter (ana vaat ilk 40'ta), `basliklar`: 3 farklı başlık (her biri ≤ 50; A/B testi için), `thumbnailText` + `thumbnailTextAlt` + `thumbnailTextAlt2`
  (3 kapak), en az 3 `bolum` (ilki ilk sahnede), `oynatmaListesi`. Vaatle başla; selam/logo/uzun tanıtım yok (U4). Süreyi hikâye belirler (U5).
  Son 5–20 sn'de ekran sade kalsın (bitiş ekranı alanı, U7). Yazılar TV'de 3 metreden okunacak büyüklükte (U8).
- **Shorts:** `title` ≤ 40 karakter (S6), `ilgiliVideo`: ilgili uzun videonun iş kimliği (ör. `2026-11-25_UCPtL84Agfh5hzoTQqE4jD0w_long1`) ya da YouTube adresi (S4);
  bağlantıya yönlendiren **tek çağrı son 5 saniyede** ("Tamamı ilgili videoda" gibi). İlk kare ve ilk cümle konuya doğrudan girer (S1). Süreyi hikâye belirler, en fazla 3 dk (S3).
- Abone/beğeni istemek serbest (O6) ama ödül/çekiliş/koşullu etkileşim yasak.
Studio'dan elle yapılan işler (A/B testi, bitiş ekranı, ilgili video) için motor videoyu en az 24 saat sonraya zamanlar ve kullanıcıya görev listesi gönderir; sen senaryoda alanları eksiksiz yaz.

## ÖNCE PAKET, SONRA SENARYO (kullanıcı kuralı 2026-11-25; `masterV4` kanalları, her video)

Sıra değişmez: **1) başlık ve kapak → 2) senaryo → 3) video.** Senaryonun tek satırını yazmadan önce:
1. Konunun en şaşırtıcı, **doğrulanmış** anını tek cümleyle bul. En az 8 başlık adayı düşün; dikkat çeken, merak boşluğu açan (zıtlık, beklenmedik sonuç, eksik bilgi, somut sayı/isim) 3 tanesini seç. Cevabı başlıkta verme; abartma, yanıltma (O4).
2. Kapakları tasarla: uzunda 3 kapak yazısı (≤4 kelime, başlığı tekrar etmez, onu tamamlar) ve videoda **gerçekten olacak** tek bir güçlü an; Shorts'ta ilk kare + `baslikKart`/dev yazı kapak yerine geçer.
   Dizi kanallarında her kapağın anını ayrı ver: `"kapaklar": [{ "sahne": 1, "sn": 1, "kadraj": [{ "id", "x", "yon", "poz", "ifade", "esya", "olcek": 1.7 }] }, …]` (3 yazıyla aynı sırada; `sahne` sıfırdan sayılır). Karakterler sağ yarıda (x 0,55-0,9) ve büyük (olcek 1,6-2), gerilimli poz ve belirgin ifade; düz duran kapak olmaz. Yazı sorar ya da eksik bırakır ("KİM GÖNDERDİ?").
3. `paket` alanına yaz: `{ "merak": "izleyicinin kafasındaki soru", "cevap": "videoda verilen cevap", "cevapSahne": sahne sırası (1'den), "kapakAni": "kapaktaki anın videodaki yeri" }`.
4. Senaryoyu bu pakete göre yaz: ilk cümle başlıktaki merakı hemen açar, cevap `cevapSahne`de ve videonun ikinci yarısında gelir, kapaktaki an videoda görünür. Doğrulayıcı `paket` yoksa ya da cevap ilk yarıda veriliyorsa reddeder.

## Kimlik sözleşmesi (her kanalda, her zaman)

Kanalların **kimliği sabittir, içerik gelişir.** Asla değiştirme, değiştirmeyi önerme, ders yazma:
- Karakterler (Nur Bey, dizi karakterleri, robot vb.), adları, görünüşleri, kişilikleri, konuşma tarzları ve hitapları.
- Sesler ve anlatıcı (kimin seslendirdiği), kanalın görsel stili (ansiklopedi/mürekkep, çöp adam animasyonu), renk kimliği, seri ve kanal adı.
- Dizi dosyaları (`diziler/*.json`): sadece keşif pilotları (`diziler/kesif-*.json`) yazılabilir.

**Değişebilen (otomatik geliştirilen) içerik:** konu seçimi, kanca cümlesinin türü ve uzunluğu, sahne sayısı ve tempo, cümle uzunluğu, ilk 30 saniyenin yapısı, hangi sahne türlerinin ne kadar kullanıldığı (dev rakam yazısı, kart, grafik, diyalog…), başlık/kapak/açıklama kalıpları, kapanış çağrısı, video süresi.
Sistem kimlikle ilgili dersleri (karakter, ses, anlatıcı, stil kelimeleri geçen) **otomatik reddeder**.

## İlk saniye (her videoda, doğrulayıcı kontrol eder)
- İlk cümle **asla** "Merhaba", "Hoş geldiniz", "Bugün size/sizlere …", "Bu videoda …", "Biliyor muydunuz?" ile başlamaz; ilk 3 cümlede "bugün … anlatacağım" tanıtımı olmaz. Doğrudan hikâyenin şaşırtıcı anından ya da sonuçtan başla.
- Uzun videoda **in medias res**: hikâyenin kırılma anından somut bir sahne (yıl, yer, kişi, eylem): "1960, Eskişehir. Cebinde parası olmayan bir adam fırının önünde duruyordu. Elindeki küçük kâğıt her şeyi değiştirecekti."
- Çizim formatında uzun videonun **ilk 6 sahnesi en fazla 10 kelime**: görüntü ilk 15 saniyede 2-3 saniyede bir değişir.

## Optimizasyon (her senaryoda)

Sistem her videonun izlenme, tıklanma ve izleyici tutma verisini ölçer; kanallar kendi verisinden öğrenir.
- **Dersler:** `brief.dersler` kanalın kendi deneylerinden ve haftalık analizden çıkan kurallardır. Hepsine uy; aşağıdaki genel kurallarla çelişirse ders geçerlidir.
- **Deney:** `needed.json` öğesinde `deney` varsa video bir A/B deneyine girer. `deney.talimat` varsa ona **kesinlikle** uy (doğrulayıcı kontrol eder) ve dosyaya `"deney": {"id": "<deney.id>", "kol": "<deney.kol>"}` yaz. Talimat yoksa (süre, müzik, saat deneyleri) sadece `deney` alanını yaz; gerisini sistem yapar. Deneyden bağımsız her şeyi her zamanki gibi en iyi şekilde yaz; sadece denenen değişken farklı olsun.
- **Çeviriler:** `needed.json` öğesinde `ceviriDilleri` varsa (ör. `["en"]`) her dil için `"ceviriler": {"en": {"title": "…", "description": "…"}}` yaz. Çeviri doğal ve o dildeki izleyicinin arayacağı kelimelerle olsun (kelimesi kelimesine değil); hashtag ve `<` `>` yazma. YouTube yabancı izleyiciye başlığı kendi dilinde gösterir.
- **Oynatma listesi:** `"oynatmaListesi": "…"` yaz (≤60 karakter). Kanalın mevcut listeleri `config/channels.json` → `oynatmaListeleri` alanındadır; konu birine uyuyorsa **aynen** o adı yaz, uymuyorsa geniş bir tema adı ver (ör. "Mutfaktaki Eşyaların Hikayesi", "Osmanlı'nın Bilinmeyenleri"). Her videoya ayrı liste açma; 4-8 tema listesi hedefle.
- **Başlık:** En fazla 70 karakter (telefonda kesilmesin, ideal 40-60). Doğrulayıcı 70'i geçeni reddeder.
- **Uzun video başlığı (tıklanma için en önemli kural):** Kanalı hiç tanımayan birine bir **vaat ya da merak** sunmalı; seri/dizi adı ve bölüm numarası **sona** gider. ✗ "Zincirli · Bölüm 4: İkinci Kez" → ✓ "Kral Sahte Dövüşü Fark Etti ve İkisini Zincirle Bağlattı | Zincirli 4". ✗ "Eşyaların Hikayesi #12: Çay Bardağı" → ✓ "İnce Belli Çay Bardağı Neden Bu Şekilde? Cevabı 1930'larda". Belgesel/ansiklopedi konularında insanların **arayacağı soruyu** başa koy ("… Nasıl Doğdu?", "… Neden …?").
- **Uzun video kapağı:** `thumbnailText` en fazla **3 kelime**, duygu ya da çatışma ("İHANET", "SON ŞANS", "YASAKLANDI"); başlığı tekrar etmez. Dizi formatında `kapak.sahne` en dramatik **karakterli** sahne olsun (dövüş, yüzleşme, şok anı); motor karakterleri büyütüp sağa alır.
- **İlk 30 saniye (uzun videoda izleyicinin çoğu burada gidiyor):** Video **ilk saniyede konuşmayla ve aksiyonla** başlar; giriş, selam, uzun başlık kartı yok. İlk 2 cümle izleyiciye **ne göreceğini/öğreneceğini vaat eder** ve bir soru açar ("Bu tencere bir zamanlar kemik yumuşatmak için icat edildi. Peki nasıl oldu da her mutfağa girdi?"). Dizi bölümlerinde soğuk açılış en gerilimli an, en fazla 15 saniye, sonunda soru. Çizim formatında giriş sahneleri en fazla 2 cümle; ilk bölüm kartı 20. saniyeden önce gelir.
- **Açıklamanın ilk iki satırı** aramada görünen kısımdır: biri videonun anahtar kelimesiyle başlayan, en az 30 karakterlik tam bir cümle olsun (ilk satır kısa bir seri etiketi olabilir). Hashtag ya da bağlantıyla başlama.
- **Uzun video ek alanları:**
  - `thumbnailText` en fazla 4 kelime ve 25 karakter (küçük ekranda okunmalı).
  - **3 kapak testi:** Her uzun videoya **üç** kapak yazısı yaz: `thumbnailText` (A), `thumbnailTextAlt` (B), `thumbnailTextAlt2` (C). Her biri ≤4 kelime, ≤25 karakter ve **farklı bir açı**: biri rakam/olgu ("22 YIL YASAK"), biri duygu/çatışma ("SULTAN İSTEMEDİ"), biri soru/merak ("KİM YASAKLADI?"). Sistem her kapağı sırayla en az 2 gün yayında tutar, tıklanma oranını ölçer ve **en çok tıklananı kalıcı yapar**; sonuç `config/performans.json` ve haftalık raporda görünür. Kazanan açıyı sonraki videolarda A kapağı olarak kullan.
  - `titleAlt`: Yedek başlık (≤70 karakter), asıl başlıktan farklı bir merak kalıbı. Kapak denemesi de tutmazsa sistem bunu dener.
  - **Bölümler:** Uzun videoda her bölümün ilk sahnesine `"bolum": {"ad": "…"}` yaz (çizim formatında zaten `{no, ust, ad}` yazılıyor). 4-7 bölüm; sistem açıklamaya YouTube bölüm zaman damgalarını (00:00 Giriş, 01:12 …) kendisi ekler.

## Konu seçimi

- **Güncel haber kanalları** (`needed.json` öğesinde `haberAkisi` varsa): Haberi **`config/haberler-<haberAkisi>.json`** listesinden seç (`plan.js` bu listeyi her çalıştığında güvenilir kaynakların RSS akışlarından son 48 saat için tazeler). `kullanildi: true` olanları ve aynı gün başka Shorts'ta seçtiğin haberi alma; Türkiye'deki izleyicinin en çok merak edeceği, büyük şirket/ürün/çığır açan gelişme haberlerini tercih et. Dosyaya `"kaynak": "<site adı>"` ve `"kaynakLink": "<listedeki link, aynen>"` yaz (doğrulayıcı listede olmayan bağlantıyı reddeder). Web araması yapabiliyorsan bağlantıyı açıp ayrıntıyı doğrula; yapamıyorsan **sadece başlık ve özetteki bilgiyi** kullan, eklemeler uydurma. Geleceğe dair kısımlar açıkça tahmin olarak söylenir ("olabilir", "bekleniyor"). Açıklamaya kaynağın adını ve bağlantısını yaz. Liste boşsa o slotu yazma.
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
- Uzun video: giriş kancası → 3-6 bölüm → akılda kalan bir kapanış. Abone + beğen çağrısı zorunlu ("Abone ve beğeni çağrısı" bölümü).
- Shorts: "Hızlı Shorts kuralı": tek sorun, 4-5 cümle, çözüm videonun içinde, son cümle çağrı.
- Metin seslendirilecek: kısaltma (M.Ö., vb., Dr.), emoji, madde işareti, parantez ve URL kullanma.
- Sayılar: Yıl, adet ve yüzdeleri **rakamla** yaz (1096, 300, %40, 1325'te); motor bunları seslendirmede doğru okunuşa çevirir, altyazıda rakam görünür. **Sıra sayılarını yazıyla** yaz ("15. yüzyıl" değil "on beşinci yüzyıl", "2. Dünya Savaşı" değil "İkinci Dünya Savaşı"). "Milattan önce" yaz, "M.Ö." yazma.
- Uzun videoda sahneler 15-60 kelime arası olsun, hiçbiri 90 kelimeyi geçmesin (Shorts'ta her sahne tek kısa cümle). Uzun videoda bir sahne yaklaşık 20-30 saniye eder. (Çizim formatında her sahne bir cümledir; yukarıdaki bölüme bak.)

## Başlık, kanca, açıklama, etiketler

- `title`: **40-60 karakter** hedefle (sınır 100). Kanıtlanmış kurallar:
  - **Merak boşluğu** aç ama cevabı verme: "600 Yıldır Kimsenin Okuyamadığı Kitap" ✓, "Voynich El Yazması Hakkında Bilgiler" ✗.
  - Mümkünse **somut bir rakam** kullan (yıl, sayı, süre). Rakamlar tıklanma oranını artırır.
  - Anahtar kelime ilk 3-4 kelimede olsun (aramada ve kesik başlıkta görünsün).
  - Yalan vaat, abartılı büyük harf, emoji yığını yok. Videoda olmayan bir şeyi vaat etme.
  - Her video kendi konusuna özel bir başlık alır. Kanalın önceki başlıklarını (`recentTitles` ve `done/`) **tekrarlama**, aynı kalıbı art arda kullanma (ör. her başlık "…Biliyor Muydunuz?" diye bitmesin). Doğrulayıcı tekrar eden başlığı reddeder. `<` ve `>` kullanma.
- `hookText`: Videonun **ilk 2,5 saniyesinde** ekranda dev harflerle beliren kanca yazısı. 2-5 kelime, en fazla 40 karakter. Shorts'ta **sorunun kendisi** ("Çayın hemen soğuyor mu?"); uzun videoda başlığı tekrarlamaz, ilk cümleyi destekler (ör. "3 kalp, mavi kan", "Kimse okuyamıyor"). Shorts ve uzun video için her zaman yaz.
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
  "thumbnailTextAlt": "3000 YILLIK YALAN",
  "thumbnailTextAlt2": "KANIT YOK",
  "titleAlt": "Truva Atı Bir Efsane mi? Arkeologların Bulduğu Şey",
  "thumbnailPrompt": "giant wooden horse in front of ancient city walls at dusk",
  "scenes": [
    {
      "narration": "…",
      "visual": { "query": "ancient city walls", "prompt": "massive stone walls of an ancient city at sunset, wide shot" }
    }
  ]
}
```

`id`, `channelId`, `type` ve `publishAt` değerlerini `needed.json`'dan **aynen** kopyala. Shorts'ta `thumbnailText`, `thumbnailTextAlt`, `thumbnailTextAlt2` ve `thumbnailPrompt` gerekmez.

## Yapma

- `queue/` dışındaki dosyalara dokunma, `config/` dosyalarını değiştirme.
- Başka kanalların veya gerçek kişilerin içeriğini kopyalama; telifli şarkı sözü, film repliği veya kitap paragrafı kullanma.
