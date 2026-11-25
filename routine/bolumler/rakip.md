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
