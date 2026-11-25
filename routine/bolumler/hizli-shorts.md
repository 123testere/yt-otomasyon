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

- **Döngülü Shorts (`needed.json` öğesinde `"dongu": true`, ör. Lamba Altında):** Son cümle veda etmez ve abone/beğen demez; **ilk cümleye bağlanır**, izleyici fark etmeden başa sarar (izlenme yüzdesi %100'ü geçer, video daha çok önerilir). Örnek: ilk cümle "Kurşun kalemin içinde tek gram kurşun yok." … son cümle "Peki o siyah iz nereden geliyor? Cevap şaşırtıcı:" → video başa döner. Abone/beğen çağrısı ekrandaki kapanış kartında yazılıdır. Doğrulayıcı son cümlede çağrı görürse reddeder.
- **Ön gösterim Shorts (`clipOf` dolu):** Uzun videonun en inanılmaz anını anlat, sonucuna gelmeden kes: "asıl hikâye kanaldaki uzun videoda". Sistem açıklamaya ve sabit yoruma uzun videonun bağlantısını kendisi ekler.
- **Spoiler / ön gösterim Shorts (`needed.json` öğesinde `"fragman": true` ve `clipOf`, dizi dışı kanallarda):** Uzun videodan **önce** yayınlanır (aynı gün ya da önceki akşam) ve izleyiciyi ona çağırır. Kaynak uzun video aynı turda yazılacaksa **önce onu yaz**. Dosyaya `"fragman": true`, `"derivedFrom": "<clipOf>"` yaz; cümlelerin en az %60'ı uzun videodan. Kurgu: ilk cümle uzun videonun en şaşırtıcı anı ("Dünyadaki bütün kilogramlar tek bir silindire bağlıydı."), 2-3 cümlede merakı büyüt, **sonucu asla verme**, son cümle: "Tamamı `<slot.uzunSaat, küçük harfle>` kanalda." (ör. "Tamamı bu akşam 18:00'de kanalda."). Çizim formatında kapanış kartı oylama değil: `"kapanis": {"fragman": true, "baslik": "<slot.uzunSaat>", "alt": "Uzun videoda, bu kanalda"}`. Başlık merak + zaman: "Kilogramın Atası Kilo Veriyordu… Tamamı Bu Akşam". Sistem uzun videonun bağlantısını açıklamaya ve sabit yoruma ekler; bağlantı uzun video yayına girince çalışır.

## Abone ve beğeni çağrısı (her videoda)

Abone ve beğeni artmıyordu; izleyiciyi açıkça yönlendiriyoruz. Doğrulayıcı çağrıyı kontrol eder.
- **Shorts:** (döngülü Shorts hariç, yukarıya bak) Son cümle kanalın dilinde, karakterin ağzından, hem **abone ol** hem **beğen** der ve bir neden verir: "Serinin devamı için abone ol ve beğen." / "Subscribe and like for the rest of the series." / "Abonniere und like für das nächste Duell!". Kalıbı her videoda biraz değiştir (devamı için, yarınki bölüm için, kaçırmamak için) ama iki kelime de geçsin.
- **Uzun videoya yönlendir:** Kanalın son 7 günde çıkmış ya da bugün çıkacak bir uzun videosu varsa (kesit, fragman ya da aynı konu), son cümle onu da söyler: "Tamamı kanaldaki uzun videoda; devamı için abone ol ve beğen." Açıklamanın ilk satırında da uzun videoya çağrı olsun (bağlantıyı motor ekler).
- **Uzun video:** İki çağrı zorunlu: (1) ilk üçte birde, vaadi verdikten hemen sonra tek cümle ("Bu seriyi kaçırmamak için şimdi abone ol."), (2) kapanışta "serinin devamı için abone ol ve beğen" + sıradaki videonun konusu. Videonun başında çağrı yapma (ilk 30 saniye kanca içindir).
- Yalvarma, uzun rica, "zile bas" listesi yok; tek kısa cümle. Yorum cevaplarında çağrı yapılmaz.
