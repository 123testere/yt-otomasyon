# Kaan AI Lab · Yeni yön (2026-11-26)

**Ne:** Claude ile gerçekten kurduğumuz video sistemini, gerçek rakamlarla anlatan 10-15 dakikalık öğretici videolar.
Her videoda: gerçek ekran görüntüsü, gerçek veri, gerçek hata ve nasıl düzeltildiği. Uydurma rakam yok, "kolay para" vaadi yok.

**Kime:** Yapay zekâyla içerik üretmek isteyen, yüzsüz kanal açan, otomasyon merak eden Türk izleyici.

**Fark:** Rakip kanallar "stili öğrettim" diyor. Biz **bir ay boyunca 6 kanalda ne oldu**, onu gösteriyoruz: tutan da, tutmayan da.

## Sürükleyicilik kuralları (her video)
1. **İlk 15 saniye:** sonuçtan bir kare + videonun tek sorusu. Selam, logo, tanıtım yok.
2. **Her 60-90 saniyede bir "açık döngü":** bir soru açılır, cevabı bir sonraki bölümde gelir ("Facebook neden 6 kat izlendi? Ona geleceğim, önce...").
3. **Her 4-8 saniyede görüntü değişir:** ekran kaydı → grafik → gerçek video karesi → kod. Aynı görüntü 8 sn'yi geçmez.
4. **Her bölümde bir hata hikâyesi:** "Burada yanıldım" anları en çok izlenen kısımdır.
5. **Rakam ekranda büyük yazılır,** anlatıcı söylerken belirir.
6. **Bölüm sonu = sonraki bölümün kancası.** Video sonunda bir sonraki video vaadi (bitiş ekranı için son 15 sn boş).
7. **Kaynak:** Rakamların hepsi sistemin kendi kayıtlarından (YouTube API, Firestore, GitHub). Açıklamada tarih ve yöntem yazılır.

## Gerçek veriler (26 Kasım 2026, YouTube API + Firestore + GitHub)
- Sistem 30 Ekim 2026'da başladı: **27 gün**.
- Otomatik yüklenen video: **181** (30 uzun, 151 Shorts).
- GitHub'da 307 değişiklik, 152 üretim çalışması.
- Instagram'a otomatik **35 Reels**, TikTok'a **31 taslak**.
- Lamba Altında: 54.576 izlenme, **43 abone**, 65 video. Son Short'lar 900-1.300'de takılıyor.
- Aynı Short Facebook'ta **6.694**, TikTok'ta 1.183, YouTube'da 1.044.
- Bölüm Bölüm 13.972 · Flaggenduell 9.510 · Kaan AI Lab 44.492 izlenme.
- Kapanan iki kanal: Untold Vault, Vice City Dispatch.
- Ücret: GitHub, Firebase, YouTube API ücretsiz; tek ücretli parça mevcut ElevenLabs aboneliği.

## Bölüm listesi (haftada 1 uzun + 1 Shorts)
| # | Başlık (≤50) | Gerçek malzeme |
|---|---|---|
| 1 | Claude 27 Günde 181 Video Yükledi: Gerçek Sonuç | Bu belgedeki rakamlar, kanal ekranları, Facebook 6.694 |
| 2 | Yumurta Kafa Stilini Kendi Dizime Uyguladım | Bölüm Bölüm öncesi/sonrası kareleri, ekran kartı olmadan 3B |
| 3 | 3B "What If" Videosunu 2 Dakikada Çizdim | What If Earth ilk videosu, dalga ve beyaz uzay hatası |
| 4 | Tek Short'u 4 Platforma Otomatik Gönderdim | Facebook 6,7 kat, TikTok'un onay kuralı (resmi belge) |
| 5 | Yapay Zekâ "Testi" Dedi, Ekranda Testi Yoktu | Detay kapısı: testi/bilezik hatası ve çözümü |
| 6 | Ücretsiz Video Fabrikası: GitHub + Firebase | 152 üretim çalışması, kota, hata bildirimleri |
| 7 | Tek Kural Tutmazsa Video Yok: Master Prompt | v4 kapısı, reddedilen senaryolar |
| 8 | Arka Plan Sesi Neden Konuşmayı Bastırdı? | LUFS ölçümleri, ses karışımı öncesi/sonrası |

## Para kazanma (YPP) hedefi
Resmi şart ([YouTube yardım](https://support.google.com/youtube/answer/72851)): **1.000 abone + son 12 ayda 4.000 saat herkese açık izlenme**
(Shorts akışındaki izlenme saate sayılmaz) ya da 1.000 abone + 90 günde 10 milyon Shorts izlenmesi. Daha düşük giriş kademesi
([genişletilmiş YPP](https://support.google.com/youtube/answer/13429240)): 500 abone + 90 günde 3 yükleme + 3.000 saat uzun video
(Türkiye'de açık mı: Studio → Para kazanma sekmesinde görünür). Şartlar dolunca inceleme ~1 ay sürer. 1 Şubat 2027'de YPP koşulları
güncelleniyor; Studio'daki yeni şartlar 31 Ocak 2027'ye kadar kabul edilmeli.

**Bugün (YouTube Analytics, son 12 ay):** 150 abone · uzun video izlenme **57 saat** · Shorts 41.835 izlenme (saate sayılmaz).
Son 90 günde kanal neredeyse durmuş (1.614 Shorts izlenmesi). Yani saat hedefinin neredeyse tamamı yeni uzun videolardan gelecek.

**Hesap:** 4.000 saat = 240.000 dakika. 12 dakikalık videoda ortalama 4-5 dakika izlenirse ≈ **50-60 bin uzun video izlenmesi**.
Haftada 1 uzun video ile yılda ~50 video → video başına ortalama ~1.100 izlenme yeter. Kodla Çiz'in ilk uzun videosu 6 günde 39.779 aldı;
yani tek bir tutan video hedefin büyük kısmını getirebilir.

**Ara hedefler (ölçüm her pazartesi, haftalık raporda):**
| Ne zaman | Abone | Uzun video saati |
|---|---|---|
| 4. video sonrası | 300 | 300 |
| 12. video sonrası | 500 | 1.200 |
| 25. video sonrası | 1.000 | 4.000 |

**İncelemeyi geçmek için (YPP "tekrarlanan / özgün olmayan içerik" kontrolü):** inceleme kanalın ana temasına, en çok izlenen,
en yeni ve en çok izlenme süresi alan videolarına bakar. Yeni format bu yüzden: Kaan'ın kendi sesi, kendi deneyi, kendi verisi, her
videoda farklı konu, gerçek hata hikâyeleri. Eski haber Shorts'ları silinmez (O11); yeni videolar çoğaldıkça incelemenin baktığı
videolar zaten yeni format olur.

## Kodla Çiz'den öğrenilenler (kopyalanmadan uygulanan)
- **Yorum değil ölçüm:** Rakamlar ekranda büyük, nasıl ölçüldüğü söylenir. Bizim farkımız: başkasının kanalını değil **kendi 6 kanalımızı** ölçüyoruz.
- **Hata anları:** "İlk kareler felaketti" gibi bölümler en çok izlenen kısımlar; her videoda en az bir gerçek hata ve düzeltmesi.
- **Açılışta selam yok;** ilk cümle sonuç ya da çelişki. İlk 5 saniyede en az 3 farklı görüntü.
- **Ücretsiz paket:** Her videoda koşulsuz bir şey verilir (şablon, kontrol listesi, ölçüm tablosu). "Abone ol, kazan" yok (v4 O6).
- **Yorum yakıtı:** Son cümle izleyiciye bir sonraki deneyi seçtirir ("hangi kanalı ölçeyim?"). Yorumlar algoritmanın yakıtı.
- **Shorts = yönlendirme:** Her uzun videodan 60 sn'lik bir Short, ilgili video bağlantısıyla (S4).

## Yapım
- **Seçilen stil: 3 · Gerçek ekran** (kullanıcı kararı 2026-11-26): koyu pano, gerçek veri pencereleri, kendi videolarımızdan kareler,
  rakam sayaçları, sarı karaoke altyazı. Her 4-8 saniyede yeni pano ya da kare.
- Ses: Kaan'ın ElevenLabs sesi (kanalın kendi sesi).
- Görüntü: gerçek ekran görüntüleri (gizli bilgiler buzlanır), kanallarımızın kendi videolarından kareler, rakam grafikleri, kod kartları.
  Başka kanalların videosu kullanılmaz (O1).
- Shorts: her uzun videodan en çarpıcı rakamın 30-45 sn'lik hâli, ilgili video = o uzun video (S4).
