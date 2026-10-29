# YT Otomasyon

4 (veya daha fazla) YouTube kanalı için uzun video + Shorts'u tamamen otomatik üretip yükleyen, ücretsiz çalışan sistem.

```
Android uygulaması ──ayarlar──▶ Firestore ◀──durum── GitHub Actions (render + YouTube'a yükleme)
                                   │                        ▲
                         saatlik senkron                     │ queue/*.json
                                   ▼                        │
                        config/needed.json ──▶ Claude rutini (her gün senaryo yazar)
```

| Klasör | Ne var |
|---|---|
| `app/` | Android uygulaması (Expo). Kanal ayarları, video durumu, bildirimler. |
| `engine/` | Video motoru: seslendirme (edge-tts), görsel (Pexels / Pollinations), FFmpeg render, YouTube yükleme. |
| `routine/PROMPT.md` | Claude'un her gün okuyup senaryo yazdığı talimat. |
| `shared/options.json` | Uygulamada çıkan tüm seçenekler (konu, dil, ses, karakter, stil…). Yeni seçenek eklemek için burayı düzenle. |
| `queue/` → `done/` / `failed/` | Senaryolar: bekleyen → yüklenen / geçersiz. |
| `assets/music/<tür>/` | Arka plan müzikleri (aşağıya bak). |

## Kurulum (bir kez)

Firebase projesi hazır: **yt-otomasyon-dk25** (Firestore + e-posta girişi açık, güvenlik kuralları yüklü).

### 1. YouTube API'yi aç
1. https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=yt-otomasyon-dk25 → **Etkinleştir**.
2. **OAuth izin ekranı** (Google Auth Platform): Tür **Harici**, uygulama adı "YT Otomasyon", destek e-postası senin adresin.
   - **Kapsamlar**: `youtube.upload` ve `youtube.readonly` ekle.
   - **Hedef kitle → Uygulamayı yayınla (In production)**. Test modunda kalırsa izinler 7 günde bir düşer.
3. **İstemciler → İstemci oluştur → Masaüstü uygulaması**. JSON'u indir, `secrets/oauth-client.json` olarak kaydet.

### 2. Firebase servis hesabı
Firebase konsolu → Proje ayarları → **Hizmet hesapları** → **Yeni özel anahtar oluştur**. İnen dosyayı `secrets/service-account.json` olarak kaydet.
> `secrets/` klasörü git'e girmez. Bu dosyaları kimseyle paylaşma.

### 3. Pexels anahtarı (ücretsiz)
https://www.pexels.com/api/ → hesap aç → API anahtarını kopyala.

### 4. GitHub
1. GitHub'da **public** bir repo aç (public'te Actions dakikası sınırsız). Bu klasörü oraya push et.
2. Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Ad | Değer |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `secrets/service-account.json` dosyasının **tüm içeriği** |
| `YT_CLIENT_ID` | `oauth-client.json` içindeki `client_id` |
| `YT_CLIENT_SECRET` | `oauth-client.json` içindeki `client_secret` |
| `PEXELS_API_KEY` | Pexels anahtarı |
| `POLLINATIONS_TOKEN` | (isteğe bağlı) https://auth.pollinations.ai ücretsiz token: YZ görselleri daha hızlı üretilir |

### 5. Kanalları bağla (her kanal için bir kez)
```
cd engine
npm install
npm run kanal-bagla
```
Tarayıcı açılır → Google hesabını seç → **hangi kanalı bağlamak istiyorsan onu seç** → izin ver. 4 kanal için 4 kez çalıştır.
"Google bu uygulamayı doğrulamadı" uyarısı çıkarsa: **Gelişmiş → YT Otomasyon'a git (güvenli değil)**. Uygulama senin, sorun yok.

### 6. Android uygulaması
```
cd app
npx eas-cli@latest login        # ücretsiz Expo hesabı
npx eas-cli@latest init         # projeyi Expo'ya bağlar
npm run apk                     # bulutta APK üretir (~15 dk), bitince indirme linki verir
```
- Bildirimler için: `npx eas-cli@latest credentials` → Android → **Google Service Account Key for FCM V1** → 2. adımdaki servis hesabı dosyasını yükle.
- APK'yı telefona kur → **Hesap oluştur** → sonra bilgisayarda bir kez:
  ```
  cd engine
  npm run yonetici-yap -- senin@epostan.com
  ```
- Uygulamadan çıkış yap, tekrar gir. Kanallar görünür. Her kanala dokunup ayarlarını seç ve **Otomasyon açık** yap.

### 7. Claude rutini
Claude Code'da bu repo için günlük bir rutin oluştur (`/schedule`). Talimat: "`routine/PROMPT.md` dosyasını oku ve uygula." Önerilen saat: her gün 03:00.

### 8. YouTube API denetimi (videoların herkese açık yayınlanması için ŞART)
Denetlenmemiş API projelerinin yüklediği videolar YouTube tarafından **gizli** kilitlenir.
https://support.google.com/youtube/contact/yt_api_form → **YouTube API Services – Audit and Quota Extension Form**. Kullanım amacını "kendi kanallarıma otomatik yükleme yapan kişisel araç" olarak anlat; aynı formda günlük kota artışı da iste. Onay birkaç hafta sürebilir.

## Müzik
YouTube Studio → **Ses Kitaplığı**'ndan telifsiz parçaları indir ve türüne göre koy:
`assets/music/epik/`, `gizemli/`, `huzurlu/`, `neseli/`, `duygusal/`, `gerilim/`, `lofi/`.
Klasör boşsa video müziksiz üretilir.

## Sınırlar
- **YouTube kotası**: Ücretsiz kotayla günde yaklaşık 6 video yüklenebilir. Fazlası "Kota bekliyor" olur ve ertesi gün yüklenir. Kota artışı için 8. adım.
- **Küçük resim**: Özel küçük resim için kanalın telefonla doğrulanmış olması gerekir (youtube.com/verify).
- **Para kazanma**: YouTube tekrarlayan, seri üretim içeriği para kazanmaya kapatıyor. Konuların gerçekten farklı ve değerli olması için Claude'a "Ek talimat" alanından yön verebilirsin.

## Elle çalıştırma
- Repo → Actions → **Ayarları senkronize et** / **Video üret ve yükle** → *Run workflow*.
- Senaryoları kontrol: `node engine/src/validate.js`
