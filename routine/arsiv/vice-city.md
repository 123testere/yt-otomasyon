## Vice City Dispatch — kampanya kesitleri (**DURDURULDU 2026-11-24**: kullanıcı kanalı kapattı; bu bölümü uygulama, bu kanala senaryo yazma)

Kanal: Vice City Dispatch (`UCaTfPvQYowD7SrHbGfotRrg`), İngilizce. Lacy / Kai Cenat / Clix'in GTA 6 maratonlarından izinli klipler (Content Rewards kampanyaları,
kurallar `config/kampanyalar.json`). Her gece 01:30'da `kesit-aday/` yenilenir: her adayda klip bilgisi, `dokum` (saniyeli konuşma dökümü) ve 3 kare (`kareler`, jpg).
**Her klibe KENDİ yorumumuzu yazarız** (v4 O1 özgünlük); yorumsuz klip yayınlanmaz. **Ses yok:** kampanyalar yapay zekâ sesini kalıcı banla cezalandırır;
yorum yalnız ekran yazısıdır (`yorum` ve `kapanis.metin` alanlarını ASLA yazma).
1. Her adayın kareleri **açıp bak** ve dökümü oku. Kampanya başına en fazla `gunluk` (2) aday seç; yayıncıyı olumsuz gösteren, anlamsız ya da GTA 6 olmayanı atla.
2. `queue/<YYYY-MM-DD>_UCaTfPvQYowD7SrHbGfotRrg_kesit-<aday id>.json` yaz (tarih = yayın günü). Yayın saatleri (Türkiye): 15:00, 16:30, 18:00, 19:30, 21:00, 23:00 —
   her seçilen klibe birini ver (`publishAt` ISO, UTC: 12:00, 13:30, 15:00, 16:30, 18:00, 20:00). Aynı kampanyayı art arda koyma.
3. Alanlar:
   - `id`, `channelId`, `type: "short"`, `format: "kesit"`, `kampanya`, `publishAt`, `topic`
   - `kaynak`: `{ "url": klip.url, "platform": "Twitch", "yayinci": zorunluAd ya da yayıncı adı, "klipId": klip.id, "izlenme", "tarih", "sure": klip.sure }`
   - `hook`: ≤70, yayıncının adıyla (ör. "LACY CAN'T BELIEVE THIS HEIST"), ilk karede konu anlaşılır (S1)
   - `title`: **≤40 karakter**, yayıncının adı geçer (S6, kampanya); `description`: yayıncının adı + klibin kısa bağlamı + kampanya etiketleri (`etiketler`, ör. `#LACY #GTA6`); `tags`: en fazla 6
   - `kredi`: `"<Ad> · twitch.tv/<twitch>"`, `cta`: `"FOLLOW FOR MORE"`
   - `ekran` (**bizim yorumumuz**, İngilizce, ABD izleyicisi için sade):
     - `baglam` (≤70): klipte ne oluyor / neden önemli — yalnız dökümde ve karelerde gördüğün bilgi (O3: uydurma yok; sayı/süre bilmiyorsan yazma)
     - `isaretler`: 1-3 adet `{ "sn": dökümdeki an, "metin": ≤40 "şuna bak", "x": 0-1, "y": 0-1 }` (x,y: karede bakılacak yer; emin değilsen x,y yazma)
     - `analiz`: `{ "metin": ≤110 }` "neden patladı": tepkinin sebebi, olayın kırılma anı (kurgu/zamanlama gözlemi)
   - `kontrol`: O1–O12, S1, S2, S3, S6 için `"evet: nasıl"`
4. `node engine/src/validate.js` hepsi ✓ olana kadar düzelt. Yayıncıyı olumsuz gösterme, logo koyma, hakaret/cinsellik yok (kampanya kuralı).
