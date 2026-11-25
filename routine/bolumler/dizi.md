## Dizi formatı (`needed.json` öğesinde `"format": "dizi"` varsa)

Bu kanal (Bölüm Bölüm) belgesel değil, **çöp adam karakterli animasyon dizisi** yayınlar. Görüntü kodla çizilir, her satırı konuşan karakter kendi sesiyle okur (ElevenLabs). Sen bölümün senaryosunu sahne sahne, saniye saniye yazarsın. Aşağıdaki "Konu seçimi", "Görsel alanları", "Hareketli grafikler" bölümleri ve `narration` / `visual` / `hookText` / `thumbnailPrompt` alanları bu kanal için **geçerli değildir**.

**Önce oku:**
- `diziler/<dizi>.json` (`needed.json` → `dizi`): dizinin özeti, `kurallar`, `karakterler` (id, görünüş, kim olduğu) ve `bolumler` (sezon planı: her bölümün `ozet` ve `son` cümlesi). Yazacağın bölüm `needed.json` → `bolum.no`. O bölümün planına uy; planda olmayan büyük olay ekleme, küçük ara sahneler ekleyebilirsin.
- Önceki bölümler: `done/` ve `queue/` içinde aynı kanalın `"format": "dizi"` dosyaları. Son bölümün nasıl bittiğini oku; yeni bölüm oradan devam eder. Karakterlerin konuşma tarzı, tekrar eden sözler ve olaylar tutarlı kalmalı.
- Örnek: `diziler/ornek/zincirli-b1.json` (onaylanmış uzun bölüm) ve `diziler/ornek/zincirli-b1-shorts.json` (onaylanmış Shorts). Yapıyı ve tempoyu bunlardan al.
- Dizi dosyasında `yazim` varsa (ör. `diziler/oyun-hikayeleri.json`: her gün Top 5 liste Shorts'u) **önce ona uy**; aşağıdaki hikâye kuralları (sezon planı, cliffhanger, soğuk açılış) o dizide geçerli değildir.

**Haftalık "Tek Parça" derleme (`needed.json` öğesinde `derleme` listesi varsa):** O haftanın bölümleri tek uzun videoda birleştirilir; sahneleri motor kendisi kurar, sen **sadece yayın bilgilerini** yazarsın. `scenes` yazma.
```json
{ "id": "…", "channelId": "…", "type": "long", "publishAt": "…", "format": "dizi", "dizi": "<needed.dizi>",
  "derleme": <needed.derleme listesi, aynen>, "bolum": <needed.bolum, aynen>,
  "title": "Zincirli · Bölüm 4-6 Tek Parça | …", "titleAlt": "…", "description": "…", "tags": ["…"], "topic": "…",
  "thumbnailText": "TEK PARÇA", "thumbnailTextAlt": "…", "thumbnailTextAlt2": "…", "oynatmaListesi": "Zincirli · 1. Sezon", "ceviriler": { … } }
```
- Başlık bölüm aralığını ve "Tek Parça" ifadesini içerir; açıklamanın ilk satırı o haftanın hikâyesini 1-2 cümlede özetler (bölümleri izlemeyenler için merak uyandırır, sonu vermez).

**Fragman Shorts'u (`needed.json` öğesinde `"fragman": true`):** Bölüm yayınlanmadan **bir gün önce** çıkar ve izleyiciyi yarınki bölüme çağırır. Kaynak bölüm (`clipOf`) aynı turda yazılıyorsa **önce bölümü yaz**, fragmanı onun satırlarından kur.
- `"fragman": true`, `"derivedFrom": "<clipOf>"`, `"dikey": true`, `"acilis": false`, `"hiz": 1.2`, `bolum` kaynak bölümle aynı. **Hızlı Shorts kuralı geçerli:** 4-5 satır, en fazla 6 sahne, ilk sahnede `buyukYazi` ile bölümün sorusu, son satır abone + beğen çağrısı; satırların en az %60'ı bölümden.
- Kurgu: en çarpıcı soru ya da tehdit cümlesiyle aç; bölümden 3-4 kısa, gerilimli an (yeni karakter, sır, dövüşün başı) art arda; **sonucu, kazananı ve son sahneyi asla gösterme**. Son sahne bölümün en büyük sorusunda kesilir.
- `kapanis`: `{"baslik": "YARIN 20:00", "sonraki": "<Dizi> · Bölüm <no>: <ad>", "soru": "<tahmin sorusu, ör. Sence Su'yu bulabilecek mi?>"}` (saat kanalın uzun video saatidir).
- Başlık merak uyandırır ve "yarın" vurgusu taşır (ör. "Yarın her şey değişiyor… ⚔️"); açıklamanın ilk satırı izleyiciye tahmin sorusu sorar, bağlantı eklenmez.

**Bağımsız dizi Shorts'u (`type: short`, `clipOf` yok):** Kendi başına bir video; `"dikey": true`, `"acilis": false`, `"hiz": 1.2` (hızlı Shorts kuralı), `bolum` needed.json'daki gibi (`{"no": <slot.bolum.no>, "ad": "<kısa konu>"}`). Kurgu dizinin `yazim` kurallarından gelir; `derivedFrom` yazma.

**Sahne yönetimi: anlatılan ne ise ekranda o görünür (kullanıcı kararı 2026-11-16, her dizi videosunda; örnekler: `ornekler/zincirli/02-zincirli-ikili-5-muhafiz.json`, `ornekler/zincirli/03-kurtarma-kacis-20sn.json` — yapıyı aynen izle):**
- **Sayı = ekrandaki kişi.** "Beş muhafız saldırdı" deniyorsa o sahnede 5 muhafız kadrajda olur (aynı `id` beş kez; kadraj en fazla 8, kalabalıkta bir kısmı `"arka": true`). Doğrulayıcı kontrol eder.
- **Eylem sözle aynı anda.** "Kılıcı kaldırıp vurdu" satırı okunurken o hareket olur: adımı o satıra bağla (`{"satir": 1, "sn": 0.3, "poz": "kilic-kaldir"}` → 1. satırın başlamasından 0,3 sn sonra). Vuruş: `kilic-kaldir` → 0,6-1 sn sonra `kilic-indir` → 0,15 sn sonra `{"darbe": true}` (kıvılcım). Her çarpmada `darbe`; vurulanın kılıcı `esya: null` ile düşer, `nesneler`de `ucus` ile uçar.
- **İşler gündelik yapılır, sihirle değil.** Kapı kendi açılmaz: karakterler kapıya yürür, `it` pozunda iter, `kapi.ac` o anda başlar. Zemin kapağı `kaldir` pozunda birlikte kaldırılır (`yerKapak.ac`). Zincir anahtarla açılır: anahtar yerde/muhafızda (`nesneler` `anahtar`), karakter yürüyüp `egil`, `esya: "anahtar"` alır, kilide yürür, `egil`, `duvarZincir.bitis`. Bir yere gitmek = yürümek: `{"sn": 2, "x": 0.4, "sure": 0.8}` (sure ≥ 0,5 yürür; `"kos": true` koşar; yönü kendisi döner).
- **Mekân değişince yeni mekân.** "Aşağı indik" → `merdiven` sahnesi (sağdan sola iner, `hareket`te `y0/y1` = −0,28×(x−0,08)/0,89 ve `"dogrusal": true`); "alt kata/mahzene vardık" → `mahzen`; kanal → `kanal`. Listede olmayan bir yer gerekiyorsa **kendin çiz**: `mekanlar/<ad>.json` (aşağıda "Yeni mekân çizmek").
- **Yavaşlat:** "Kılıç yanımdan geçti", "son anda" gibi cümlelerde sahneye `"efektler": ["agir-cekim"]` ver; karakter eğilir/kayar, kılıç yüzünün hemen önünden geçer (iz ağır görünür).
- **Saniye saniye açıklama (zorunlu):** her sahnenin `aciklama`sı o sahnede kimin ne yaptığını saniye aralıklarıyla yazar: `"0-1,2 sn: Arın kapıya yürür. 1,2-3 sn: Kargan'la birlikte omuz verip iter, kapı ağır ağır açılır. 3-4 sn: ikisi içeri koşar."` Sahne süresini satırların kelime sayısından tahmin et (~2,6 kelime/sn + `once`). Doğrulayıcı aralık yoksa reddeder.
- **Bölüm tanıtımı (zorunlu):** `"tanitim": ["Zindandan kaçış", "Su altından kaçış", "Kapalı çıkış"]` — 2-4 kısa madde (≤28 karakter); videonun ilk saniyelerinde, soğuk açılış sürerken "BU BÖLÜMDE" olarak belirir. Merak uyandırır, sonucu söylemez.
- **Sonraki videoya merak (zorunlu):** Son sahne çözülmemiş bir soruda kesilir; `kapanis.sonraki` sonraki bölümün adını ve bir merak cümlesini taşır (≤50: "Bölüm 8: Akıl Hocası — Toros'a kılıç kaldıracak mı?"), `kapanis.soru` seçmeli soru. Shorts'ta da son cümle bir sonraki videoyu merak ettirir.
- **Yeni araçlar:** pozlar `kilic-hazir` (dövüş duruşu), `kilic-indir` (tek vuruş), `it`, `kaldir`; eşya `anahtar`; sahne alanları `kapi` {x, ac, sure} (zindanda ağır kapı), `yerKapak` {x, ac, sure} (zindan zemininde kapak), `gecit` {x, ac} (zindan duvarında gizli geçit; kapalıyken çatlak görünür), `duvarZincir` [{id, x, y, sn, bitis}] (karakterin elinden duvardaki halkaya zincir; `sn` takılır, `bitis` açılır), `zincir.el: "arka"` (iki karakterin boştaki elleri zincirli, sırt sırta dövüşte kopmaz); kadraj öğesinde `arka`, `hareket.bas` (gecikmeli giriş), `hareket.y0/y1/dogrusal`; adımda `satir`, `sure`, `kos`, `y`.
- Şiddet kuralı geçerli: kan ve ölüm yok; vurulan silahsız kalır, düşer (`dus` → `yerde`), bağışlanır.
- **Ses ve müzik kendiliğinden gelir:** temas sesleri (kılıç çarpması `darbe`, savurma `kilic-indir`, adımlar yürüme/koşmadan, düşme `dus`, yere düşen kılıç/anahtar `ucus` bitişi, kapı gıcırtısı `kapi.ac`, kapak `yerKapak.ac`, taş geçit `gecit.ac`, zincir ve kilit `duvarZincir`) ve mekân ortamı (kanalda su, zindanda damla ve meşale, arenada kalabalık) sahne verisinden üretilir; bu yüzden eylemi **mutlaka** adımlarla yaz, yoksa sesi de olmaz. Müzik sahnenin ruh haline göre seçilir (dövüş → epik, kaçış/zorlanma → gerilim, hüzün → duygusal, zindan/kanal → gizemli); farklı istiyorsan sahneye `"muzik": "epik|gerilim|gizemli|duygusal|huzurlu"` yaz. Aynı ruh hali hep dizinin aynı parçasını çalar.

**Yeni mekân çizmek (`mekanlar/<ad>.json`):** Hikâye listede olmayan bir yerde geçiyorsa (saray mutfağı, kule odası, liman…) en yakınını seçme, o yeri çiz. Dosya: `{ "ad": "<ad, a-z ve tire>", "aciklama": "ne olduğu", "kod": "<JavaScript>" }`; sahnede `"mekan": "<ad>"`. Kod tam ekranı (W×H; yatay 1920×1080, dikey 1080×1920) her karede çizer. Kullanılabilenler: `ctx` (canvas 2D), `W`, `H`, `t` (video sn, animasyon için), `u` (sahne sn), `ayak` (karakterlerin ayak çizgisi; zemin bunun biraz üstünden başlamalı), `h(n)` tohumlu rastgele 0-1, `eo`, `pr(u,a,b)`, `tasDuvar(x0,y0,x1,y1,{boy,en,renk:[r,g,b],oyna,seed})` taş/tuğla duvar, `mesale(x,y,t,olcek,seed)` titreyen meşale ve ışığı, `toz(x0,y0,w,h,t,'r,g,b',adet)` uçuşan zerreler. Yasak: Math.random, Date, while, fetch/import/window/document; en fazla 15000 karakter. **Ayrıntı ekle**: arka duvar dokusu, derinlik (ön/arka plan), ışık kaynağı ve ışığın düştüğü yer, en az 4-5 nesne (mobilya, alet, kapı, pencere), hareketli bir öğe (alev, su, toz, sallanan şey). Doğrulayıcı kodu iki boyutta çalıştırıp dener; `mekanlar/` dosyasını senaryolarla birlikte commit et.

**Uzun bölüm (`type: long`):**
- 3-4 dakika: satırlardaki toplam kelime `targetWords` ±%30 (doğrulayıcı kontrol eder). 18-26 sahne.
- Yapı: **Soğuk açılış** (bölümün en gerilimli anından 10-20 saniye, ilk sahnede `"kisim": "Soğuk Açılış"`), sonra 3-5 kısım. Her kısmın ilk sahnesinde `kisim` (YouTube bölüm adı olur) ve `kart` (`{"ust": "BİRİNCİ KISIM", "alt": "Demirci'nin Oğlu"}`) olur. Son sahne bölüm planındaki `son` ile biten bir cliffhanger.
- Anlatıcı dizinin `anlatici.id` karakteridir (Zincirli'de yetişkin Arın, birinci tekil şahıs). Anlatıcı satırı `"kim": "anlatici"`. Diyaloglar karakter id'siyle (`"kim": "toros"`). Kısa, ağır, akılda kalan cümleler; bir satır en fazla 220 karakter, çoğu 4-14 kelime.
- Şiddet gösterilmez: kan ve ölüm yok, dövüşler silahsızlandırma ya da bağışlamayla biter.
- `kapanis`: `{"baslik": "DEVAMI", "sonraki": "Bölüm <no+1>: <sonraki bölümün adı> — Yakında", "soru": "<izleyiciye seçmeli soru>"}`. Son bölümde `sonraki` "Sezon finali" olur.
- Kapak: `thumbnailText` (2-3 kelime, ≤25 karakter, bölümün duygusu: "ÜÇ SANİYE", "YARIM BİLEZİK") ve `"kapak": {"sahne": <sahne sırası, 0'dan>, "sn": <sahnenin kaçıncı saniyesi>}`. Kapak sahnesinde karakterler **sağ yarıda** dursun (x ≥ 0,55; yazı solda), en dramatik poz olsun (kılıç kaldırmış dev, yerde kahraman, kırık zincir).
- `titleAlt`, `thumbnailTextAlt` ve `thumbnailTextAlt2` de yazılır (yukarıdaki optimizasyon kuralları: 3 kapak testi). Başlık kalıbı: `"<Dizi adı> · Bölüm <no>: <bölüm adı>"` ya da merak uyandıran bir cümle + bölüm etiketi; ≤70 karakter.
- `oynatmaListesi`: dizinin adı ve sezonu ("Zincirli · 1. Sezon").

**Shorts (`type: short`, `clipOf` dolu):** Bölümün **hızlı, merak uyandıran kısa hali**; bölümü izlemeye çağırır.
- `"derivedFrom": "<clipOf>"`, `"dikey": true`, `"acilis": false`, `"hiz": 1.2`, `bolum` kaynak bölümle aynı.
- **Hızlı Shorts kuralı geçerli:** 4-5 satır, en fazla 6 sahne, kelime `targetWords` ±%30. Satırların en az %60'ı kaynak bölümden gelir (kısaltabilirsin). İlk sahnede `buyukYazi` ile bölümün sorusu; son satır "cevabı kanaldaki bölümde; devamı için abone ol ve beğen" benzeri.
- Kurgu: (1) İlk saniyede sorun: bölümün en gerilimli karesi + tek cümle ("Ölmeme üç saniye vardı."). (2) Bölümün en iyi 2-3 anı, her biri tek satır. (3) **Doruk noktasında kes**: sonucu gösterme. (4) Çağrı satırı. (5) `kapanis`: `{"baslik": "NE OLDU?", "sonraki": "Tamamı kanalda: <Dizi> · Bölüm <no>", "soru": "<seçmeli soru>"}`.
- Dikey ekranda yatay kadraj kullanma: karakterleri x 0,2-0,8 arasına yerleştir, yerde yatan karakter ekran dışına taşmasın.
- Başlık kısa, merak uyandıran ve bölüm başlığından farklı ("Ölmesine 3 saniye vardı… ⚔️"); `#shorts` yazma (motor ekler). Açıklamanın ilk satırı izleyiciye soru, bölüm bağlantısını motor ekler.

**Dosya alanları:**
```json
{
  "id": "…", "channelId": "…", "type": "long", "publishAt": "…",
  "format": "dizi", "dizi": "zincirli", "bolum": {"no": 2, "ad": "Kızıl Loca"},
  "tanitim": ["Kralın kararı", "Kızıl locadaki yüz", "Kaçış planı"],
  "title": "…", "titleAlt": "…", "description": "…", "tags": ["…"], "topic": "…",
  "thumbnailText": "KIZIL LOCA", "thumbnailTextAlt": "…", "thumbnailTextAlt2": "…", "kapak": {"sahne": 0, "sn": 2},
  "oynatmaListesi": "Zincirli · 1. Sezon", "muzik": "epik", "muzikSeviye": 0.1,
  "kapanis": {"baslik": "DEVAMI", "sonraki": "Bölüm 3: Yarım Bilezik — Yakında", "soru": "…"},
  "scenes": [
    {
      "kisim": "Soğuk Açılış", "kart": {"ust": "…", "alt": "…"},
      "mekan": "arena", "zaman": "gece", "efektler": ["agir-cekim"], "kalabalik": 1,
      "aciklama": "0-0,8 sn: Arın sağdan koşarak girer. 0,8-1,8 sn: kılıcı kaldırıp indirir, Kargan'ın kılıcına çarpar (kıvılcım). 1,8-3 sn: kılıç uçar, Kargan dizlerinin üstüne çöker.",
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
- `mekan`: destan mekânları `koy-gunduz`, `koy-yangin`, `kervan`, `tas-ocagi`, `zindan`, `avlu`, `arena`, `loca`, `merdiven` (sağ üstten sol alta taş merdiven), `mahzen` (tonozlu, fıçılı, çıkışlı), `kanal` (su kanalı, kenar yolu, çıkışta demir parmaklık), `sur` (gece kale suru, ay ışığı, meşaleler) ve `mekanlar/` altındaki çizilmiş mekânlar; köy mekânları `meydan`, `kuyu`, `ev-ic`, `orman`, `yol`, `kule-ic`; oyun mekânları `garaj` (evde stüdyo), `ofis` (oyun stüdyosu), `oyun-salonu` (atari salonu), `fuar` (oyun fuarı sahnesi, `kalabalik` ile), `grafik` (yükselen satış grafiği, `veri`: 2-8 artan sayı), `siralama` (Top 5 kartı için).
- `buyukYazi`: `{"ust": "2,5 MİLYAR $", "alt": "tek bir oyun"}` sahne boyunca ekranda dev sarı yazı (ust ≤14, alt ≤30). Rakam ve yıl vurgusu için.
- `sira`: `{"no": 5, "ad": "Valheim", "tur": "Viking hayatta kalma", "maddeler": ["…", "…", "…"]}` sıralama kartı (no 1-10, ad ≤28, tur ≤30, en fazla 3 madde ≤24); altta 5-4-3-2-1 geri sayım çubuğu kendiliğinden çizilir. Listede olmayan bir yer için en yakınını seç (saray salonu → `loca` ya da `kule-ic`, demirhane → `ev-ic`, dağ yolu → `yol`).
- `zaman`: `gece`, `gunduz`, `safak` (köy mekânlarında). `efektler`: `agir-cekim`, `beyaz-cakma` (darbe/geçiş), `sis`, `yagmur`, `simsek`, `titreyen-isik`, `ruzgar`. `kalabalik` (arena tribünü) 0-1.
- `kadraj`: en fazla 8 karakter (aynı `id` birden çok kez olabilir: 5 muhafız), `id` dizinin `karakterler` listesinden. Kalabalıkta geridekilere `"arka": true`. `x` 0-1 (yatayda konum), `yon` 1 sağa / -1 sola bakar. Karakterler birbirine bakacak şekilde yerleşsin.
- `poz`: `dur`, `yuru`, `kos`, `isaret`, `korku`, `dusun`, `el-salla`, `omuz`, `eller-belde`, `egil`, `kilic-kaldir`, `kilic-savur`, `saldir`, `blok`, `darbe`, `dus`, `yerde`, `kalk`, `zincirli`, `diz-cok`, `zafer`, `tasi`, `kilic-hazir`, `kilic-indir`, `it`, `kaldir`.
- `esya`: `kilic`, `kalkan`, `kilic+kalkan`, `tahta-kilic`, `mesale`, `fener`, `baston`, `tas`, `oyun-kolu`, `kupa`, `disket`, `anahtar` (ya da adımda `null`: elden düşer).
- `ifade`: `notr`, `endiseli`, `gulumsuyor`, `uzgun`, `korkmus`, `saskin`, `kizgin`, `dusunceli`, `supheli`, `fisilti`.
- `hareket`: sahne başında `x0`'dan `x1`'e yürür (`kos: true` koşar); -0,3 ile 1,3 arası ekrana girip çıkmayı sağlar.
- `adimlar`: sahnenin `sn`. saniyesinde poz/konum/eşya/ifade değişimi; `darbe: true` kırmızı çarpma ve sarsıntı, `sarsinti: true` ekran sarsıntısı. Dövüşleri adım adım kurgula: saldır → blok → darbe → düş → kalk.
- `nesneler`: yerdeki `kilic`, `kalkan`, `kirik-kalkan`, `anahtar`; `ucus` havada uçarak oraya düşer, `gorun` / `kaybol` saniyeleri.
- `zincir`: iki karakter arasında `sn` saniyede fırlayan zincir (Arın'ın imza hamlesi).
- `sure`: konuşmasız aksiyon sahnesinin en az süresi (sn). Konuşmasız sahneye mutlaka yaz.
- Satırda `once`: satırdan önce sessiz bekleme (aksiyonun görünmesi için). Satırda rakam yerine yazı tercih et ("on beş yıl"); `( ) * # [ ] < >` kullanma.
- `muzik`: `epik`, `gerilim`, `gizemli`, `duygusal`, `huzurlu` (bölümün duygusu); `muzikSeviye` 0,08-0,14.
