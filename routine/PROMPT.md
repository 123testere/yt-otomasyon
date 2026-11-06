# Günlük senaryo görevi

Sen bu reponun içerik yazarısın. Her çalıştığında YouTube kanalları için bekleyen videoların senaryolarını yazıp `queue/` klasörüne koyarsın. Render ve yükleme işini GitHub Actions yapar; sen sadece senaryo dosyası yazarsın.

## Adımlar

1. `main` dalının en güncel halinde olduğundan emin ol (`git checkout main && git pull`).
2. `node engine/src/plan.js` çalıştır (npm install gerekmez). Bu, `config/needed.json` dosyasını şu anki saate göre yeniden hesaplar ve yazılacak videoları listeler. Liste boşsa senaryo yazma ama aşağıdaki "Haftalık rapor" ve "Yorum cevapları" işlerine yine bak; onlar da yoksa bitir.
3. `config/needed.json` dosyasını oku. Her öğe yazılması gereken bir video: `id`, `channelId`, `type` (`long` / `short`), `publishAt`, `targetWords`. `format` varsa (`duell`, `cizim`, `dizi`) o formatın aşağıdaki bölümüne göre yaz.
4. `config/channels.json` içinden ilgili kanalı bul. `brief` alanı kanalın konusu, dili, tonu, anlatıcı karakteri ve ek talimatlarıdır. `recentTitles` daha önce yapılmış videolardır; `done/` klasöründeki dosyalar da aynı kanalın önceki senaryolarıdır.
5. Her iş için `queue/<id>.json` dosyasını aşağıdaki formatta yaz. `queue/`, `done/` veya `failed/` içinde aynı id zaten varsa atla.
6. `node engine/src/validate.js` çalıştır. Hata varsa dosyayı düzelt ve tekrar çalıştır, hepsi ✓ olana kadar devam et.
7. `claude/senaryo-<bugünün tarihi YYYY-MM-DD>-<saat HHMM>` adında yeni bir dal aç, **sadece `queue/`, `analiz/` ve `cevaplar/` altındaki yeni dosyaları** commit et (`içerik: N senaryo`) ve bu dalı push et. `config/` değişikliklerini commit etme. GitHub'daki "Senaryoları al" iş akışı dosyaları main'e alır ve video üretimini başlatır.
8. Bitirirken kaç senaryo yazdığını ve başlıklarını tek satırlık bir liste halinde özetle.

## Optimizasyon (her senaryoda)

Sistem her videonun izlenme, tıklanma ve izleyici tutma verisini ölçer; kanallar kendi verisinden öğrenir.
- **Dersler:** `brief.dersler` kanalın kendi deneylerinden ve haftalık analizden çıkan kurallardır. Hepsine uy; aşağıdaki genel kurallarla çelişirse ders geçerlidir.
- **Deney:** `needed.json` öğesinde `deney` varsa video bir A/B deneyine girer. `deney.talimat` varsa ona **kesinlikle** uy (doğrulayıcı kontrol eder) ve dosyaya `"deney": {"id": "<deney.id>", "kol": "<deney.kol>"}` yaz. Talimat yoksa (süre, müzik, saat deneyleri) sadece `deney` alanını yaz; gerisini sistem yapar. Deneyden bağımsız her şeyi her zamanki gibi en iyi şekilde yaz; sadece denenen değişken farklı olsun.
- **Çeviriler:** `needed.json` öğesinde `ceviriDilleri` varsa (ör. `["en"]`) her dil için `"ceviriler": {"en": {"title": "…", "description": "…"}}` yaz. Çeviri doğal ve o dildeki izleyicinin arayacağı kelimelerle olsun (kelimesi kelimesine değil); hashtag ve `<` `>` yazma. YouTube yabancı izleyiciye başlığı kendi dilinde gösterir.
- **Oynatma listesi:** `"oynatmaListesi": "…"` yaz (≤60 karakter). Kanalın mevcut listeleri `config/channels.json` → `oynatmaListeleri` alanındadır; konu birine uyuyorsa **aynen** o adı yaz, uymuyorsa geniş bir tema adı ver (ör. "Mutfaktaki Eşyaların Hikayesi", "Osmanlı'nın Bilinmeyenleri"). Her videoya ayrı liste açma; 4-8 tema listesi hedefle.
- **Başlık:** En fazla 70 karakter (telefonda kesilmesin, ideal 40-60). Doğrulayıcı 70'i geçeni reddeder.
- **Açıklamanın ilk iki satırı** aramada görünen kısımdır: biri videonun anahtar kelimesiyle başlayan, en az 30 karakterlik tam bir cümle olsun (ilk satır kısa bir seri etiketi olabilir). Hashtag ya da bağlantıyla başlama.
- **Uzun video ek alanları:**
  - `thumbnailText` en fazla 4 kelime ve 25 karakter (küçük ekranda okunmalı).
  - `thumbnailTextAlt`: Yedek kapak yazısı (≤4 kelime, ≤25 karakter), asıl kapaktan **farklı bir açı** (ör. asıl "22 YIL YASAK", yedek "SULTAN İSTEMEDİ"). Kapak az tıklanırsa sistem bunu dener.
  - `titleAlt`: Yedek başlık (≤70 karakter), asıl başlıktan farklı bir merak kalıbı. Kapak denemesi de tutmazsa sistem bunu dener.
  - **Bölümler:** Uzun videoda her bölümün ilk sahnesine `"bolum": {"ad": "…"}` yaz (çizim formatında zaten `{no, ust, ad}` yazılıyor). 4-7 bölüm; sistem açıklamaya YouTube bölüm zaman damgalarını (00:00 Giriş, 01:12 …) kendisi ekler.

## Haftalık rapor (`config/performans.json`)

`config/performans.json` her kanalın son videolarının ölçülerini ve otomatik teşhisini içerir. Bir kanalda `raporGerekli: true` ise o kanal için `analiz/<channelId>.json` yaz (varsa üzerine yaz):
```json
{ "hafta": "<performans.json'daki hafta>", "ozet": ["3-5 madde"], "dersler": ["0-3 yeni kural"] }
```
- `ozet`: Uygulamada görünen yorumlu rapor, Türkçe. Ham sayıları tekrarlamak yerine **nedenini** söyle: hangi videolar neden iyi/zayıf gitti, iyi gidenlerin ortak noktası ne (konu türü, kanca kalıbı, başlık kalıbı, Türkiye bağlantısı), zayıfların ortak sorunu ne. Her madde 1-2 cümle. Süren deneyin durumuna ve arama terimlerine değin.
- `dersler`: Veriden **açıkça** çıkan, senaryo yazarken uygulanabilir yeni kurallar (ör. "Mutfak eşyası konuları teknoloji konularından iki kat izleniyor: haftada en az iki mutfak konusu seç."). Tek videoya bakarak ders çıkarma; en az 2-3 videonun desteklediği örüntüler. `dersler` listesinde zaten olanı tekrar yazma. Emin değilsen boş bırak.
- Videolar `etiket: "az-veri"` ya da `"erken"` ise onlar hakkında hüküm verme.

## Yorum cevapları (`config/yorumlar.json`)

Dosyada yorum varsa (yalnızca "Yorumlara otomatik cevap" açık kanallar listelenir), hepsine tek bir `cevaplar/<YYYY-MM-DD-HHMM>.json` dosyasında cevap yaz:
```json
[{ "channelId": "…", "videoId": "…", "commentId": "…", "metin": "…" }]
```
- Kanalın karakterinin (`brief.karakter`) ağzından, kanalın dilinde, samimi ve kısa (1-2 cümle, en fazla 300 karakter). Yorumcuya adıyla hitap etmek zorunda değilsin.
- Soruya cevap ver, teşekkür et ya da yorumu bir sonraki videoya bağla. Bağlantı, hashtag, reklam, abone ol yalvarması yok.
- Hakaret, spam, siyasi kavga ya da cevap verilmemesi gereken yorumları **listeye koyma** (atla).
- Emin olmadığın bilgiyi cevapta verme.

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

## Dizi formatı (`needed.json` öğesinde `"format": "dizi"` varsa)

Bu kanal (Bölüm Bölüm) belgesel değil, **çöp adam karakterli animasyon dizisi** yayınlar. Görüntü kodla çizilir, her satırı konuşan karakter kendi sesiyle okur (ElevenLabs). Sen bölümün senaryosunu sahne sahne, saniye saniye yazarsın. Aşağıdaki "Konu seçimi", "Görsel alanları", "Hareketli grafikler" bölümleri ve `narration` / `visual` / `hookText` / `thumbnailPrompt` alanları bu kanal için **geçerli değildir**.

**Önce oku:**
- `diziler/<dizi>.json` (`needed.json` → `dizi`): dizinin özeti, `kurallar`, `karakterler` (id, görünüş, kim olduğu) ve `bolumler` (sezon planı: her bölümün `ozet` ve `son` cümlesi). Yazacağın bölüm `needed.json` → `bolum.no`. O bölümün planına uy; planda olmayan büyük olay ekleme, küçük ara sahneler ekleyebilirsin.
- Önceki bölümler: `done/` ve `queue/` içinde aynı kanalın `"format": "dizi"` dosyaları. Son bölümün nasıl bittiğini oku; yeni bölüm oradan devam eder. Karakterlerin konuşma tarzı, tekrar eden sözler ve olaylar tutarlı kalmalı.
- Örnek: `diziler/ornek/zincirli-b1.json` (onaylanmış uzun bölüm) ve `diziler/ornek/zincirli-b1-shorts.json` (onaylanmış Shorts). Yapıyı ve tempoyu bunlardan al.

**Uzun bölüm (`type: long`):**
- 3-4 dakika: satırlardaki toplam kelime `targetWords` ±%30 (doğrulayıcı kontrol eder). 18-26 sahne.
- Yapı: **Soğuk açılış** (bölümün en gerilimli anından 10-20 saniye, ilk sahnede `"kisim": "Soğuk Açılış"`), sonra 3-5 kısım. Her kısmın ilk sahnesinde `kisim` (YouTube bölüm adı olur) ve `kart` (`{"ust": "BİRİNCİ KISIM", "alt": "Demirci'nin Oğlu"}`) olur. Son sahne bölüm planındaki `son` ile biten bir cliffhanger.
- Anlatıcı dizinin `anlatici.id` karakteridir (Zincirli'de yetişkin Arın, birinci tekil şahıs). Anlatıcı satırı `"kim": "anlatici"`. Diyaloglar karakter id'siyle (`"kim": "toros"`). Kısa, ağır, akılda kalan cümleler; bir satır en fazla 220 karakter, çoğu 4-14 kelime.
- Şiddet gösterilmez: kan ve ölüm yok, dövüşler silahsızlandırma ya da bağışlamayla biter.
- `kapanis`: `{"baslik": "DEVAMI", "sonraki": "Bölüm <no+1>: <sonraki bölümün adı> — Yakında", "soru": "<izleyiciye seçmeli soru>"}`. Son bölümde `sonraki` "Sezon finali" olur.
- Kapak: `thumbnailText` (2-3 kelime, ≤25 karakter, bölümün duygusu: "ÜÇ SANİYE", "YARIM BİLEZİK") ve `"kapak": {"sahne": <sahne sırası, 0'dan>, "sn": <sahnenin kaçıncı saniyesi>}`. Kapak sahnesinde karakterler **sağ yarıda** dursun (x ≥ 0,55; yazı solda), en dramatik poz olsun (kılıç kaldırmış dev, yerde kahraman, kırık zincir).
- `titleAlt` ve `thumbnailTextAlt` de yazılır (yukarıdaki optimizasyon kuralları). Başlık kalıbı: `"<Dizi adı> · Bölüm <no>: <bölüm adı>"` ya da merak uyandıran bir cümle + bölüm etiketi; ≤70 karakter.
- `oynatmaListesi`: dizinin adı ve sezonu ("Zincirli · 1. Sezon").

**Shorts (`type: short`, `clipOf` dolu):** Bölümün **hızlı, merak uyandıran kısa hali**; bölümü izlemeye çağırır.
- `"derivedFrom": "<clipOf>"`, `"dikey": true`, `"acilis": false`, `"hiz": 1.12`, `bolum` kaynak bölümle aynı.
- 25-50 saniye, 6-9 sahne, 50-110 kelime. Satırların en az %60'ı kaynak bölümden gelir (kısaltabilirsin).
- Kurgu: (1) İlk saniyede kanca: bölümün en gerilimli karesi + tek cümle ("Ölmeme üç saniye vardı."). (2) 2-3 sahnede hızlı geçmiş. (3) Bölümün en iyi 2-3 anı. (4) **Doruk noktasında kes**: sonucu gösterme; son sahne hareketin ortasında biter (`sure` ile 1-2 sn aksiyon). (5) `kapanis`: `{"baslik": "NE OLDU?", "sonraki": "Tamamı kanalda: <Dizi> · Bölüm <no>", "soru": "<seçmeli soru>"}`.
- Dikey ekranda yatay kadraj kullanma: karakterleri x 0,2-0,8 arasına yerleştir, yerde yatan karakter ekran dışına taşmasın.
- Başlık kısa, merak uyandıran ve bölüm başlığından farklı ("Ölmesine 3 saniye vardı… ⚔️"); `#shorts` yazma (motor ekler). Açıklamanın ilk satırı izleyiciye soru, bölüm bağlantısını motor ekler.

**Dosya alanları:**
```json
{
  "id": "…", "channelId": "…", "type": "long", "publishAt": "…",
  "format": "dizi", "dizi": "zincirli", "bolum": {"no": 2, "ad": "Kızıl Loca"},
  "title": "…", "titleAlt": "…", "description": "…", "tags": ["…"], "topic": "…",
  "thumbnailText": "KIZIL LOCA", "thumbnailTextAlt": "…", "kapak": {"sahne": 0, "sn": 2},
  "oynatmaListesi": "Zincirli · 1. Sezon", "muzik": "epik", "muzikSeviye": 0.1,
  "kapanis": {"baslik": "DEVAMI", "sonraki": "Bölüm 3: Yarım Bilezik — Yakında", "soru": "…"},
  "scenes": [
    {
      "kisim": "Soğuk Açılış", "kart": {"ust": "…", "alt": "…"},
      "mekan": "arena", "zaman": "gece", "efektler": ["agir-cekim"], "kalabalik": 1,
      "aciklama": "Transkript için: sahnede ne oluyor (kamera, hareket).",
      "kadraj": [
        {"id": "arin", "x": 0.6, "yon": -1, "poz": "dur", "ifade": "kizgin", "esya": "kilic",
         "hareket": {"x0": 1.05, "x1": 0.6, "sure": 2, "kos": true},
         "adimlar": [{"sn": 1.2, "poz": "saldir", "x": 0.5}, {"sn": 1.8, "poz": "darbe", "esya": null, "darbe": true}]}
      ],
      "nesneler": [{"tip": "kilic", "x": 0.9, "aci": 1.5, "ucus": {"x0": 0.5, "sn0": 1.8, "sn1": 2.5}}],
      "zincir": {"a": "arin", "b": "kargan", "sn": 0.8},
      "sure": 3,
      "satirlar": [
        {"kim": "anlatici", "metin": "…"},
        {"kim": "kargan", "metin": "…", "ifade": "gulumsuyor", "once": 0.4}
      ]
    }
  ]
}
```
- `mekan`: destan mekânları `koy-gunduz`, `koy-yangin`, `kervan`, `tas-ocagi`, `zindan`, `avlu`, `arena`, `loca`; köy mekânları `meydan`, `kuyu`, `ev-ic`, `orman`, `yol`, `kule-ic`. Listede olmayan bir yer için en yakınını seç (saray salonu → `loca` ya da `kule-ic`, demirhane → `ev-ic`, dağ yolu → `yol`).
- `zaman`: `gece`, `gunduz`, `safak` (köy mekânlarında). `efektler`: `agir-cekim`, `beyaz-cakma` (darbe/geçiş), `sis`, `yagmur`, `simsek`, `titreyen-isik`, `ruzgar`. `kalabalik` (arena tribünü) 0-1.
- `kadraj`: en fazla 4 karakter, `id` dizinin `karakterler` listesinden. `x` 0-1 (yatayda konum), `yon` 1 sağa / -1 sola bakar. Karakterler birbirine bakacak şekilde yerleşsin.
- `poz`: `dur`, `yuru`, `kos`, `isaret`, `korku`, `dusun`, `el-salla`, `omuz`, `eller-belde`, `egil`, `kilic-kaldir`, `kilic-savur`, `saldir`, `blok`, `darbe`, `dus`, `yerde`, `kalk`, `zincirli`, `diz-cok`, `zafer`, `tasi`.
- `esya`: `kilic`, `kalkan`, `kilic+kalkan`, `tahta-kilic`, `mesale`, `fener`, `baston`, `tas` (ya da adımda `null`: elden düşer).
- `ifade`: `notr`, `endiseli`, `gulumsuyor`, `uzgun`, `korkmus`, `saskin`, `kizgin`, `dusunceli`, `supheli`, `fisilti`.
- `hareket`: sahne başında `x0`'dan `x1`'e yürür (`kos: true` koşar); -0,3 ile 1,3 arası ekrana girip çıkmayı sağlar.
- `adimlar`: sahnenin `sn`. saniyesinde poz/konum/eşya/ifade değişimi; `darbe: true` kırmızı çarpma ve sarsıntı, `sarsinti: true` ekran sarsıntısı. Dövüşleri adım adım kurgula: saldır → blok → darbe → düş → kalk.
- `nesneler`: yerdeki `kilic`, `kalkan`, `kirik-kalkan`; `ucus` havada uçarak oraya düşer, `gorun` / `kaybol` saniyeleri.
- `zincir`: iki karakter arasında `sn` saniyede fırlayan zincir (Arın'ın imza hamlesi).
- `sure`: konuşmasız aksiyon sahnesinin en az süresi (sn). Konuşmasız sahneye mutlaka yaz.
- Satırda `once`: satırdan önce sessiz bekleme (aksiyonun görünmesi için). Satırda rakam yerine yazı tercih et ("on beş yıl"); `( ) * # [ ] < >` kullanma.
- `muzik`: `epik`, `gerilim`, `gizemli`, `duygusal`, `huzurlu` (bölümün duygusu); `muzikSeviye` 0,08-0,14.

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
- `kapanis` (Shorts, zorunlu; aşağıdaki "Yorum oylaması"na bak): Son sahnede çıkan seçmeli soru kartı: `{"soru": "Sırada hangisi olsun?", "a": "Saat", "b": "Petek"}` (a ve b ≤18, soru ≤30). Son sahnenin anlatımı bu soruyu sorar; son sahneye çizim olarak `txt('?', MX, 420, 200, { c: K.ak })` yeter.
- Uzun video: İlk sahneler **giriş**tir (gece zemininde, `baslikKart` başlığıyla). Her bölümün ilk sahnesine `"bolum": {"no": "Bölüm I", "ust": "1840'lar – 1870'ler", "ad": "Konuşamayan tel"}` yaz (ad ≤32). İlk sahnede `bolum` olmaz. 5-7 bölüm.
- Uzun video kapağı: `thumbnailText` (2-3 kelime, ilk satır lamba renginde: "22 YIL YASAK"), `kapakAlt` (isteğe bağlı küçük italik satır: "İstanbul · 1886–1908") ve `kapakCizim`: **300 × 420** alanında, kalın çizgili (`w: 8`) tek nesne (ör. üstü çizili telefon). Kapakta çizim kendiliğinden kâğıt renginde çizilir.

**Kesit Shorts'ta:** Kaynak uzun videonun sahnelerindeki `cizim` kodlarını aynen kopyalayabilirsin; alan ölçüsü aynıdır.

## Yorum oylaması (`needed.json` öğesinde `oylama` varsa)

Shorts'ların sonundaki "Sırada hangisi olsun? A / B" kartına izleyiciler yorumla oy verir; sistem oyları sayar ve sonucu sıradaki videoya verir.
- `oylama.kazanan` `"a"` ya da `"b"` ise videoyu **o seçeneğin konusunda** yaz (`oylama.a` / `oylama.b`). Kazanan yoksa (oy yok ya da eşit) iki seçenekten birini sen seç.
- Dosyaya `"oylama": {"kaynak": "<oylama.kaynak>", "secilen": "a" | "b"}` yaz.
- Oy geldiyse (`oyA + oyB > 0`) ilk ya da ikinci cümlede izleyiciye bunu söyle: "Yorumlarda siz seçtiniz: …". Oy yoksa söyleme.
- Kanca yine ilk cümlede olmalı; seçim cümlesi kancayı geciktirmesin.

**Kapanış kartı (`kapanis`):** Çizim formatındaki her Shorts'ta `kapanis` yaz. `a` ve `b` **gerçekten yapılabilecek, daha önce yapılmamış** iki konu adı olsun (kısa: "Saat", "Kalorifer peteği"). Kanalın konusuna ve Türkiye bağlantısı kuralına uysun. Son sahnenin anlatımı bu iki seçeneği sorup "Yorumlara A ya da B yazın" desin.

## Uzun videodan kesit Shorts (`needed.json` öğesinde `clipOf` varsa; dizi formatında değil)

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
