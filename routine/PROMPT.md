# Günlük senaryo görevi

Sen bu reponun içerik yazarısın. Her çalıştığında YouTube kanalları için bekleyen videoların senaryolarını yazıp `queue/` klasörüne koyarsın. Render ve yükleme işini GitHub Actions yapar; sen sadece senaryo dosyası yazarsın.

## Adımlar

1. `main` dalının en güncel halinde olduğundan emin ol (`git checkout main && git pull`).
2. `node engine/src/plan.js` çalıştır (npm install gerekmez). Bu, `config/needed.json` dosyasını şu anki saate göre yeniden hesaplar ve yazılacak videoları listeler. Liste boşsa senaryo yazma ama aşağıdaki "Gün sonu değerlendirmesi", "Günlük iyileştirme", "Haftalık rapor" ve "Yorum cevapları" işlerine yine bak; onlar da yoksa bitir.
3. `config/needed.json` dosyasını oku. Her öğe yazılması gereken bir video: `id`, `channelId`, `type` (`long` / `short`), `publishAt`, `targetWords`. `format` varsa (`duell`, `cizim`, `dizi`) o formatın aşağıdaki bölümüne göre yaz.
4. `config/channels.json` içinden ilgili kanalı bul. `brief` alanı kanalın konusu, dili, tonu, anlatıcı karakteri ve ek talimatlarıdır. `recentTitles` daha önce yapılmış videolardır; `done/` klasöründeki dosyalar da aynı kanalın önceki senaryolarıdır.
5. Her iş için `queue/<id>.json` dosyasını aşağıdaki formatta yaz. `queue/`, `done/` veya `failed/` içinde aynı id zaten varsa atla.
6. `node engine/src/validate.js` çalıştır. Hata varsa dosyayı düzelt ve tekrar çalıştır, hepsi ✓ olana kadar devam et.
7. `claude/senaryo-<bugünün tarihi YYYY-MM-DD>-<saat HHMM>` adında yeni bir dal aç, **sadece `queue/`, `analiz/`, `cevaplar/`, `iyilestirme/`, `kesif/` altındaki ve `diziler/kesif-*.json` yeni dosyaları** commit et (`içerik: N senaryo`) ve bu dalı push et. `config/` değişikliklerini commit etme. GitHub'daki "Senaryoları al" iş akışı dosyaları main'e alır ve video üretimini başlatır.
8. Bitirirken kaç senaryo yazdığını ve başlıklarını tek satırlık bir liste halinde özetle.

## Kimlik sözleşmesi (her kanalda, her zaman)

Kanalların **kimliği sabittir, içerik gelişir.** Asla değiştirme, değiştirmeyi önerme, ders yazma:
- Karakterler (Nur Bey, dizi karakterleri, robot vb.), adları, görünüşleri, kişilikleri, konuşma tarzları ve hitapları.
- Sesler ve anlatıcı (kimin seslendirdiği), kanalın görsel stili (ansiklopedi/mürekkep, çöp adam animasyonu), renk kimliği, seri ve kanal adı.
- Dizi dosyaları (`diziler/*.json`): sadece keşif pilotları (`diziler/kesif-*.json`) yazılabilir.

**Değişebilen (otomatik geliştirilen) içerik:** konu seçimi, kanca cümlesinin türü ve uzunluğu, sahne sayısı ve tempo, cümle uzunluğu, ilk 30 saniyenin yapısı, hangi sahne türlerinin ne kadar kullanıldığı (dev rakam yazısı, kart, grafik, diyalog…), başlık/kapak/açıklama kalıpları, kapanış çağrısı, video süresi.
Sistem kimlikle ilgili dersleri (karakter, ses, anlatıcı, stil kelimeleri geçen) **otomatik reddeder**.

## Hızlı Shorts kuralı (her kanalda, her Shorts; `needed.json` öğesinde `"hizli": true`)

Kanallar büyümüyordu; kullanıcı kararıyla (2026-11-13) **bütün Shorts'lar** bu kalıpla yazılır. Bu bölüm, aşağıdaki format bölümlerinde Shorts için yazan eski süre, sahne ve kelime sayılarının **yerine geçer**; doğrulayıcı bunu kontrol eder.

- **4-5 cümle, çok hızlı.** Toplam kelime `targetWords` ±%30 (Türkçe ~55 kelime, yaklaşık 20-28 saniye). Her cümle kısa (en fazla 14 kelime), dolgu yok, giriş yok. Motor seslendirmeyi ayrıca hızlandırır.
- **Sorun → çözüm.** Video izleyicinin tanıdığı bir **sorunu ya da cevabını merak ettiği bir soruyu** çözer:
  1. cümle: **sorun** (izleyiciye soru ya da "sen de…" diye seslenen iddia). İlk saniyede söylenir.
  2.-4. cümle: **çözüm / cevap**: somut, doğrulanabilir, adım ya da bilgi. Vaat edilen cevap videonun içinde **mutlaka** verilir.
  Son cümle: **çağrı** (aşağıdaki "Abone ve beğeni çağrısı"). Oylama sorusu varsa aynı son cümlede birleşir.
- **Deneyle birlikte:** `deney.talimat` ilk cümlenin soru olmamasını istiyorsa sorunu **iddia** olarak söyle ("Çayın ikinci yudumda soğuyor, suç bardakta."); soru olmasını istiyorsa soru olarak sor. Dizi `yazim` kuralındaki "soru olarak sor" ifadesi deney talimatının altındadır.
- **Başlık sorunu söyler** (≤60 karakter): ✓ "Çayın Bardakta Neden Hemen Soğuyor?", ✓ "Arkadaşlarınla Oynayacak Oyun Bulamıyor musun? 🎮", ✓ "Broke by the 20th Every Month? 💰". ✗ "Çay Bardağının Tarihi", ✗ "En İyi 5 Oyun". Bilgi/tarih kanallarında sorun = izleyicinin günlük hayatta takıldığı soru ("… neden böyle?", "… nasıl çıktı?").
- **Ekranda dev sorun yazısı** (ilk saniyeden itibaren, büyük ve okunaklı): çizim formatında `baslikKart` (2 satır, sorunun kendisi), dizi formatında ilk sahnede `buyukYazi` (`ust` ≤14 karakter: sorunun 1-2 kelimelik hali, `alt` ≤30), diğer formatlarda `hookText`.
- **Format karşılıkları:**
  - *Çizim (Lamba Altında):* 5-6 sahne (her sahne bir cümle ve bir çizim). Son sahne oylama kartı + çağrı.
  - *Dizi, liste/haber kanalları:* dizi dosyasındaki `yazim` kuralları (hızlı Shorts'a göre güncellendi: sorun + 3 çözüm + çağrı). `"hiz": 1.2`.
  - *Dizi, hikâye (Bölüm Bölüm kesit ve fragman):* 4-5 satır, en fazla 6 sahne, `"hiz": 1.2`. İlk sahnede `buyukYazi` bölümün sorusunu söyler ("KRAL ANLADI MI?"); çözüm = sorunun cevabına götüren 2-3 en gerilimli an; son satır çağrı + "cevabı/tamamı kanaldaki bölümde". Satırların en az %60'ı yine bölümden gelir.
  - *Flaggenduell:* başlık zaten soru; anlatım 55-95 kelime (7 bölümün her biri tek kısa cümle), `table` bölümü abone + beğen çağrısıyla biter.

## Abone ve beğeni çağrısı (her videoda)

Abone ve beğeni artmıyordu; izleyiciyi açıkça yönlendiriyoruz. Doğrulayıcı çağrıyı kontrol eder.
- **Shorts:** Son cümle kanalın dilinde, karakterin ağzından, hem **abone ol** hem **beğen** der ve bir neden verir: "Serinin devamı için abone ol ve beğen." / "Subscribe and like for the rest of the series." / "Abonniere und like für das nächste Duell!". Kalıbı her videoda biraz değiştir (devamı için, yarınki bölüm için, kaçırmamak için) ama iki kelime de geçsin.
- **Uzun videoya yönlendir:** Kanalın son 7 günde çıkmış ya da bugün çıkacak bir uzun videosu varsa (kesit, fragman ya da aynı konu), son cümle onu da söyler: "Tamamı kanaldaki uzun videoda; devamı için abone ol ve beğen." Açıklamanın ilk satırında da uzun videoya çağrı olsun (bağlantıyı motor ekler).
- **Uzun video:** İki çağrı zorunlu: (1) ilk üçte birde, vaadi verdikten hemen sonra tek cümle ("Bu seriyi kaçırmamak için şimdi abone ol."), (2) kapanışta "serinin devamı için abone ol ve beğen" + sıradaki videonun konusu. Videonun başında çağrı yapma (ilk 30 saniye kanca içindir).
- Yalvarma, uzun rica, "zile bas" listesi yok; tek kısa cümle. Yorum cevaplarında çağrı yapılmaz.

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

## Günlük iyileştirme (her çalıştırmada, `config/performans.json`)

İzlenmeleri yukarı taşımak senin görevin. Her çalıştırmada her kanalın `videolar` listesindeki **uzun videolara** bak (`tip: "long"`, yayın 2-21 gün önce). **Shorts'ta** (yayın 2-7 gün önce, `izlenme` < 100) yalnızca `title` değiştirilebilir: başlığı sorunu söyleyen kalıba çevir (kapak ve `thumbnailText` yazma):
- **Zayıf tıklanma:** `tiklanma7` < 3 (ve `gosterim7` ≥ 50) → yeni başlık + yeni kapak yazısı yaz.
- **Zayıf tutma:** `tutma` < 25 ya da `kancaOran` düşük → başlık/kapak videonun vaat ettiğinden farklı bir şey vaat ediyor olabilir; vaadi videonun gerçek içeriğine yaklaştıran yeni başlık yaz.
- Aynı videoya en fazla **3 günde bir** dokun (`sonIyilestirme` tarihine bak); `kapakDeneme` "deneniyor" ya da "baslik-deneniyor" ise o videoya dokunma (sistem A/B ölçüyor).
- Videonun senaryosunu `done/<jobId>.json` içinde oku; başlık ve kapak **gerçek içeriğe** dayanmalı, yalan vaat yok.

Yazacağın dosya: `iyilestirme/<YYYY-MM-DD-HHMM>.json`
```json
[{ "youtubeId": "…", "title": "Yeni başlık (≤70, kurallara uygun)", "thumbnailText": "≤3 KELİME", "kapak": {"sahne": 7, "sn": 2}, "neden": "tıklanma %0,9; seri adı başta, vaat yok" }]
```
- `title` ve `thumbnailText` isteğe bağlı (sadece değiştirmek istediğini yaz). `kapak` sadece dizi formatında, farklı bir sahne seçmek için.
- Bir çalıştırmada en fazla 6 uzun video ve 6 Shorts. Hiçbir video eşiklerin altında değilse dosya yazma.
- Sistem değişikliği YouTube'da uygular, eski değeri ve önceki tıklanmayı kaydeder; sonraki günlerde `tiklanma7` yükselmediyse farklı bir açı dene (aynı kalıbı tekrarlama). Bir değişiklik tuttuysa (tıklanma ya da izlenme arttıysa) bunu haftalık raporda `dersler`e yaz.

## Gün sonu değerlendirmesi (her gece, **bütün** kanallar; `config/performans.json`)

Her gün, günün ilk çalıştırmasında (gece) her kanal için o günü değerlendir ve `analiz/gunluk-<kanalId>.json` yaz (varsa üzerine yaz). Dosyanın `tarih` alanı bugünün tarihiyse o kanalı atla (günde bir kez). `videolar` listesi boş olan (henüz video yüklenmemiş) kanalı atla.

Bak: `videolar` listesinde son 3 günde yayınlananlar ve dünden beri en çok artanlar. Alanlar: `izlenme` (toplam), `izlenmeArtis` (son ölçümden beri, yaklaşık 1 gün), `hedef` (bugünkü izlenmenin 2 katı; en az 100), `tutma` (ortalama izlenme yüzdesi), `kancaOran` (Shorts'ta kaydırmayıp izleyenlerin oranı), `tiklanma7`, `abone7`, `begeni7`, `nedenler` (otomatik teşhis). Senaryoyu `done/<jobId>.json` içinde oku.

Soru her video için aynı: **"Bu video X izlendi; 2X almak için ne yapacağız?"** Cevap somut ve uygulanabilir olsun:
- `kancaOran` düşük (< 0,5) → ilk cümle/dev yazı sorunu yeterince net söylemiyor: yarınki videoda sorunu ilk 3 kelimeye taşı; bu videonun başlığını sorun kalıbına çevir (`iyilestirme/` dosyasıyla).
- `tutma` düşük (Shorts < %60, uzun < %30) → çözüm geç geliyor ya da dolgu var: cümle sayısını/kelimeyi azalt, cevabı 2. cümleye al.
- İzlenme iyi ama `abone7` / `begeni7` sıfıra yakın → çağrı zayıf: çağrıya neden ekle ("devamı yarın"), uzun videoya bağla.
- İzlenme sıfıra yakın ve `gosterim7` çok düşük → konu/başlık aranmıyor ve önerilmiyor: `aramaTerimleri` ve rakip `fikirler` listesinden konu seç.
- İyi giden video (kanal medyanının 2 katı) → **neden tuttuğunu** yaz ve yarın aynı sorun alanından devam videosu planla.

```json
{
  "tarih": "YYYY-MM-DD",
  "ozet": ["Bugünün 2-4 maddelik değerlendirmesi: ne tuttu, ne tutmadı, neden (sayıyı değil sebebi söyle)"],
  "videolar": [{ "youtubeId": "…", "baslik": "…", "izlenme": 100, "hedef": 200, "neden": "neden bu kadarda kaldı / neden tuttu", "aksiyon": "2 katına çıkarmak için yaptığımız ya da yarın yapacağımız somut şey" }],
  "yarin": ["Yarınki senaryolarda uygulanacak 1-3 somut değişiklik"]
}
```
- `videolar`: en fazla 8 (en yeni ve en öğretici olanlar). `ozet` ve `yarin` Türkçe, kısa; uygulamada ve bildirimde görünür.
- **Uygula:** `yarin` maddelerini aynı çalıştırmada yazdığın senaryolara uygula. Başlık/kapak değişikliği gerekiyorsa `iyilestirme/` dosyasına yaz (sistem YouTube'da uygular). Bir örüntü en az 2-3 videoda tekrarlıyorsa haftalık raporda `dersler`e ekle.
- Kimlik sözleşmesi burada da geçerli: karakter, ses, stil değişikliği önerme. `etiket: "erken"` videolar için "henüz erken" de, hüküm verme.

## Rakip analizi (`config/rakipler/<kanalId>.json` ve `.jpg`)

Otomasyonun en önemli parçası: bizimle aynı işi yapıp **bizden başarılı** kanalların neyi doğru yaptığını bulup bizim yorumumuzla uygulamak. Rakip taraması haftada bir (pazar) çalışır.
- `config/rakipler/<kanalId>.json` dosyasının `guncellendi` tarihi `analiz/rakip-<kanalId>.json` içindeki `kaynak` tarihinden yeniyse (ya da analiz dosyası yoksa) o kanal için analiz yaz.
- **Kapak panosunu gör:** `config/rakipler/<kanalId>.jpg` görselini aç (Read aracı görselleri gösterir). Kapaklar 4 sütunlu ızgarada, soldan sağa ve yukarıdan aşağı `patlayanlar` listesindeki `sira` sırasıyla dizilidir.
- Kendi kanalımızla ilgisiz videoları (konu dışı, tesadüfen eşleşen) yok say.

Yazacağın dosya: `analiz/rakip-<kanalId>.json`
```json
{
  "kaynak": "<rakipler json'daki guncellendi>",
  "ozet": ["3-6 madde: bu nişte ne patlıyor, neden"],
  "kapak": ["kapak kalıpları: renk, karakter/yüz, yazı büyüklüğü ve sayısı, kompozisyon (gözlemle, somut yaz)"],
  "baslik": ["başlık kalıpları (ör. '<Nesne> Nasıl Buldular?', 'Kim İcat Etti … Kovuldu'), uzunluk, merak tekniği"],
  "icerik": ["süre, yapı, açıklama ve bölüm kullanımı, yayın gün/saatleri"],
  "bizimFark": ["biz neyi farklı/eksik yapıyoruz; en önemli 3 düzeltme"],
  "fikirler": [{ "konu": "…", "neden": "hangi patlayan videodan/kalıptan", "bizimAci": "bizim yorumumuz: hangi yeni bilgi/bağlantı (Türkiye, karakter, seri)", "format": "long|short", "baslikOnerisi": "…", "kapakYazisi": "≤3 kelime" }]
}
```
- `fikirler`: 6-10 tane. Rakibin videosunun **kopyası değil**: aynı merak alanına bizim araştırmamız, anlatıcımız ve kanal kimliğimizle yeni bir açı. Aynı konuyu birebir anlatacaksan farklı bir soru sor ya da farklı bir bağlantı kur.
- **Senaryo yazarken:** O kanalın `analiz/rakip-<kanalId>.json` dosyasını oku. Konu seçerken önce `fikirler` listesinden (daha önce kullanılmamış olanlardan) seç, kapak ve başlıkta `kapak`/`baslik` kalıplarını uygula, `bizimFark` maddelerini düzelt. Rakibin başlığını, kapak yazısını ya da metnini **aynen kullanma**.
- Rakip verisindeki yayın saatleri (`saatDagilimi`) haftalık raporda yayın saati önerisi için kullanılır; saat değişikliği önerini `ozet`e yaz.

## Keşif: yeni kanal fırsatları (`config/kesif.json`, `config/kesif.jpg`)

Haftalık tarama, son 1 yılda açılıp hızla büyüyen animasyon kanallarını bulur. `config/kesif.json` dosyasının `guncellendi` tarihi `analiz/kesif.json` içindeki `kaynak`tan yeniyse değerlendir.
- `config/kesif.jpg`: her adayın en çok izlenen videosunun kapağı, 4 sütunlu ızgarada `sira` sırasıyla.
- **Ele:** Gerçek animasyon olmayanları (gerçek çekim, oyun videosu, reklam), **bizim araçlarımızla üretilemeyenleri** (3D, karmaşık karakter animasyonu, Roblox), dublaj/parodi ve telifli karakter kullananları, çocuklara yönelik içerikleri.
- Bizim araçlarımız: `dizi-cop` (çöp adam karakterler, mekânlar, sıralama/haber kartları, dev yazı), `cizim` (ansiklopedi mürekkep çizimi), `hareketli-grafik`, YZ görselli anlatım. Fırsatı bunlardan biriyle **özgün** şekilde yapabilmeliyiz.
- `analiz/kesif.json` yaz: `{ "kaynak": "<guncellendi>", "firsatlar": [ { "kanalId", "puan" (1-10), "dil", "motor", "tur" (short|long), "neden", "bizimAci", "risk", "konsept", "kanalAdlari" (3 öneri), "ornekKonu", "renkler" (3 hex: koyu zemin, vurgu, açık), "maliyet" } ] }`. En fazla 6 fırsat, puana göre sıralı. Puan: izlenme hızı + para potansiyeli (İngilizce iş/finans > İngilizce genel > Türkçe) + üretilebilirlik + özgünlük payı.

## Keşif örneği (`config/kesif-istekler.json` doluysa)

Kullanıcı uygulamada bir fırsata "Örnek yap" dedi. Her istek için **özgün** bir pilot hazırla (fırsatın `konsept`, `bizimAci`, `renkler`, `ornekKonu` alanları rehberdir; `not` varsa kullanıcının isteğidir; `tekrar: true` ise önceki örnekten **farklı bir açı** dene):
1. `diziler/kesif-<kısa-ad>.json`: dizi dosyası (`diziler/oyun-hikayeleri.json` ve `diziler/para-top5.json` örneklerindeki alanlar): `id` (dosya adıyla aynı), `ad` (kanal adı önerisi), `dil`, `stil: "cop"`, `format` ("yatay" uzun, dikey Shorts için de "yatay" yaz; Shorts'ta `dikey: true` iş dosyasında), `rozetNo: false`, `muzik`, `muzikSeviye: 0.06`, `kurallar`, `yazim`, `anlatici`, `karakterler` (özgün isim, renk ve aksesuarlar; fırsat kanalının karakterlerini **kopyalama**). **Dil:** pilot, kimlik ve dizi dosyası fırsatın `dil` alanındaki dilde yazılır (kullanıcı `not`ta başka dil istemedikçe); dizi dosyasına `"dil"` yaz. **Sesler o dilin Microsoft sesleri olmalı** (erkek / kadın): tr `tr-TR-AhmetNeural` / `tr-TR-EmelNeural`, en `en-US-AndrewNeural` / `en-US-JennyNeural`, de `de-DE-ConradNeural` / `de-DE-KatjaNeural`, es `es-MX-JorgeNeural` / `es-MX-DaliaNeural`, pt `pt-BR-AntonioNeural` / `pt-BR-FranciscaNeural`. Türkçe metni İngilizce sesle okutma.
2. `kesif/<kanalId>/pilot.json`: dizi formatında **tek video** (yukarıdaki "Dizi formatı" kurallarıyla; `format: "dizi"`, `dizi: "kesif-<kısa-ad>"`, `channelId: "KESIF"`, `type` fırsatın türü; Shorts ise `dikey: true, acilis: false, hiz: 1.05`), başlık, açıklama, etiketler; `bolum: {"no": 1, "ad": "…"}`.
3. `kesif/<kanalId>/kimlik.json`: `{ "kanalAdlari": [3], "slogan": "≤30", "aciklama": "kanal açıklaması (dilinde, 2-4 cümle)", "etiketler": [8-12], "renkler": [3 hex], "anaKarakter": "<karakter id>", "dizi": "kesif-<kısa-ad>", "ayarlar": { "language": "tr|en|…", "niche": "animasyon", "shortsTimes": ["12:00"], "longDays": [], "longTime": "18:00", "minutes": 8, "music": "epik", "hashtags": "#…" } }`. Yayın saatlerini fırsat kanalının ve dil bölgesinin izleyici saatine göre seç.
- Dosyaları yazdıktan sonra `node engine/src/validate.js` pilotu kontrol etmez; yine de pilotu diziErrors kurallarına uygun yaz (mekân/poz/eşya listeleri). Sistem pilotu render edip uygulamada gösterir; **hiçbir kanala yüklenmez**.

## Haftalık rapor (`config/performans.json`)

`config/performans.json` her kanalın son videolarının ölçülerini ve otomatik teşhisini içerir. Bir kanalda `raporGerekli: true` ise o kanal için `analiz/<channelId>.json` yaz (varsa üzerine yaz):
```json
{ "hafta": "<performans.json'daki hafta>", "ozet": ["3-5 madde"], "dersler": ["0-3 yeni kural"] }
```
- `ozet`: Uygulamada görünen yorumlu rapor, Türkçe. Ham sayıları tekrarlamak yerine **nedenini** söyle: hangi videolar neden iyi/zayıf gitti, iyi gidenlerin ortak noktası ne (konu türü, kanca kalıbı, başlık kalıbı, Türkiye bağlantısı), zayıfların ortak sorunu ne. Her madde 1-2 cümle. Süren deneyin durumuna ve arama terimlerine değin.
- **Sahne analizi** (`sahneAnalizi.short` / `.long`, `yeterli: true` ise): `enCokKaybettiren` (o tür sahnede izleyici kanal ortalamasından `oran` kat hızlı gidiyor) ve `enIyiTutan` listeleri, `kanca` (kısa/uzun ilk sahnede 3. saniye tutması). Bunlardan **içerik** dersi çıkar: ör. "Uzun cümleli sahneler 1,4 kat izleyici kaybettiriyor: Shorts'ta sahne başına en fazla 12 kelime", "Dev rakam yazılı sahneler en iyi tutan tür: her Shorts'ta en az 2 tane". Kimliğe dokunma (karakter yerine sahne/cümle/tempo/yapı).
- **Haftada en fazla bir büyük içerik değişikliği** (süre, yapı, tempo): sistem izlenme iki hafta üst üste düşerse son eklenen kuralı kendisi geri alır; çok kural birden eklersen hangisinin işe yaradığı anlaşılmaz.
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
- `mekan`: destan mekânları `koy-gunduz`, `koy-yangin`, `kervan`, `tas-ocagi`, `zindan`, `avlu`, `arena`, `loca`, `merdiven` (sağ üstten sol alta taş merdiven), `mahzen` (tonozlu, fıçılı, çıkışlı), `kanal` (su kanalı, kenar yolu, çıkışta demir parmaklık) ve `mekanlar/` altındaki çizilmiş mekânlar; köy mekânları `meydan`, `kuyu`, `ev-ic`, `orman`, `yol`, `kule-ic`; oyun mekânları `garaj` (evde stüdyo), `ofis` (oyun stüdyosu), `oyun-salonu` (atari salonu), `fuar` (oyun fuarı sahnesi, `kalabalik` ile), `grafik` (yükselen satış grafiği, `veri`: 2-8 artan sayı), `siralama` (Top 5 kartı için).
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

## Çizim formatı (`needed.json` öğesinde `"format": "cizim"` varsa)

Bu kanalın videoları stok görselle değil, **kodla mürekkep çizimiyle** yapılır (eski bir ansiklopedi sayfası; anlatıcı Nur Bey lambası ekranda kendiliğinden çizilir). Her sahnenin görüntüsünü sen `cizim` alanına JavaScript olarak yazarsın. Dosyaya `"format": "cizim"` yaz. Bu formatta `visual.motion` ve `thumbnailPrompt` kullanılmaz; `hookText` yerine `baslikKart` yazılır.

**Sahneler:** Her sahne **bir cümle** (en fazla iki kısa cümle) ve o cümleyi anlatan **tek bir çizim**. Shorts'ta 5-6 sahne (hızlı Shorts kuralı: 4-5 cümle + çağrı), uzun videoda 60-120 sahne olur. Çizim cümlenin somut nesnesini gösterir (çay bardağı, simit, telefon, dükkân, harita, zaman çizgisi, kesit). Yazı sadece etiket ve tarih olarak kullanılır, cümleyi ekrana yazmak yasak (altyazı zaten var).

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
- `kapanis` (Shorts, zorunlu; aşağıdaki "Yorum oylaması"na bak): Son sahnede çıkan seçmeli soru kartı: `{"soru": "Sırada hangisi olsun?", "a": "Saat", "b": "Petek"}` (a ve b ≤18, soru ≤30). Kartın altında "abone ol ve beğen" yazısı kendiliğinden çıkar. Son sahnenin anlatımı bu soruyu sorar ve abone + beğen çağrısını yapar; son sahneye çizim olarak `txt('?', MX, 420, 200, { c: K.ak })` yeter.
- Uzun video: İlk sahneler **giriş**tir (gece zemininde, `baslikKart` başlığıyla). Her bölümün ilk sahnesine `"bolum": {"no": "Bölüm I", "ust": "1840'lar – 1870'ler", "ad": "Konuşamayan tel"}` yaz (ad ≤32). İlk sahnede `bolum` olmaz. 5-7 bölüm.
- Uzun video kapağı: `thumbnailText` (2-3 kelime, ilk satır lamba renginde: "22 YIL YASAK"), `kapakAlt` (isteğe bağlı küçük italik satır: "İstanbul · 1886–1908") ve `kapakCizim`: **300 × 420** alanında, kalın çizgili (`w: 8`) tek nesne (ör. üstü çizili telefon). Kapakta çizim kendiliğinden kâğıt renginde çizilir.

**Kesit Shorts'ta:** Kaynak uzun videonun sahnelerindeki `cizim` kodlarını aynen kopyalayabilirsin; alan ölçüsü aynıdır.

## Yorum oylaması (`needed.json` öğesinde `oylama` varsa)

Shorts'ların sonundaki "Sırada hangisi olsun? A / B" kartına izleyiciler yorumla oy verir; sistem oyları sayar ve sonucu sıradaki videoya verir.
- `oylama.kazanan` `"a"` ya da `"b"` ise videoyu **o seçeneğin konusunda** yaz (`oylama.a` / `oylama.b`). Kazanan yoksa (oy yok ya da eşit) iki seçenekten birini sen seç.
- Dosyaya `"oylama": {"kaynak": "<oylama.kaynak>", "secilen": "a" | "b"}` yaz.
- Oy geldiyse (`oyA + oyB > 0`) ilk ya da ikinci cümlede izleyiciye bunu söyle: "Yorumlarda siz seçtiniz: …". Oy yoksa söyleme.
- Kanca yine ilk cümlede olmalı; seçim cümlesi kancayı geciktirmesin.

**Kapanış kartı (`kapanis`):** Çizim formatındaki her Shorts'ta `kapanis` yaz. `a` ve `b` **gerçekten yapılabilecek, daha önce yapılmamış** iki konu adı olsun (kısa: "Saat", "Kalorifer peteği"). Kanalın konusuna ve Türkiye bağlantısı kuralına uysun. Son sahnenin anlatımı **tek cümlede** bu iki seçeneği sorar ve çağrıyı yapar: "Sırada saat mi, petek mi; yorumlara yaz, devamı için abone ol ve beğen."

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
