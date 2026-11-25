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
