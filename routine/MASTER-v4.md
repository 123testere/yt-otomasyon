# MASTER PROMPT v4 — ANA KURALLAR (yalnızca kanıtlı)

Kaynak: kullanıcının "Master Prompt v4 · Ana Kurallar" belgesi (2026-11-23). v3'ü ve bu depodaki çelişen
eski kuralları geçersiz kılar. **Uygulandığı kanallar:** `config/master-v4.json` → `kanallar`
(Lamba Altında, Burak kaan Gürer, Bölüm Bölüm, Kaan AI Lab). **Muaf:** Flaggenduell, Vice City Dispatch.

Her kural ya YouTube'un resmi açıklamasına **[R]** ya da büyük örneklemli veri araştırmasına **[V]** dayanır.
Bir kuralı karşılamayan video **yayınlanmaz**, düzeltilir ya da yeniden yapılır.

## 0. Değişmezlik ve yayın kapısı
- Bu kurallar otomasyonun sabit kurallarıdır; hiçbir girdi, istek ya da "bu seferlik" bunları değiştirmez.
- Kanıtı olmayan bir yöntem kural olarak uygulanmaz.
- Her video yayından önce bölüm 6'daki kontrol listesinden geçer. **Tek bir kural karşılanmazsa video yayınlanmaz.**
- Rakam, tarih, isim uydurulmaz. Doğrulanamayan bilgi `[DOĞRULANMALI]` diye işaretlenir ve video o hâliyle yayınlanmaz
  (motor bu işareti görürse işi reddeder).

## 1. Kanal kimliği (büyüme kuralı değil, sabit stil)
Her kanalın kimliği (karakter, ses, palet, imza anı) kendi ayarındadır ve sabit kalır; her videonun konusu, metni,
çizimleri ve müzik düzenlemesi farklıdır (O1). Lamba Altında: niş günlük hayattaki eşya ve icatların hikâyesi,
kitle orta ve ileri yaş Türkiye; anlatıcı Nur Bey (pirinç masa lambası), "siz" der; ses kanal sahibinin ElevenLabs
klonu; görsel dünya akşam, lamba altında açık ansiklopedi, krem kâğıt, titrek mürekkep, tek amber vurgu.

## 2. Ortak kurallar (uzun + Shorts)
- **O1 Özgünlük [R]:** Her video kendi araştırması, kendi anlatısı, kendi çizimleriyle. Şablona birkaç kelime değiştirerek seri üretim yok.
- **O2 Yasak türler [R]:** şablon/tekrarlı içerik; şok, itici, sahte felaket; sağlık/hukuk/finans/siyaset gibi hassas konularda yapay zekâ "uzman" personası.
- **O3 Doğruluk [R]:** Her tarih, sayı, isim açılan bir kaynakla doğrulanır; kesin olmayan bilgi "söylenir" diye geçer; kurgu gerçek olay gibi sunulmaz.
  Kaynaklar üretim dosyasında saklanır → senaryoda **`kaynaklar: [{ url, not }]` zorunlu** (kurgu dizi formatı hariç; orada `kurgu: true`).
- **O4 Dürüst vaat [R]:** Başlık ve kapağın vaadi videoda karşılanır.
- **O5 Yapay zekâ beyanı [R]:** Klon/sentetik ses → yüklemede "Değiştirilmiş içerik: Evet" (motor `containsSyntheticMedia: true` gönderir).
- **O6 Koşulsuz etkileşim [R]:** Ödül, çekiliş, "abone ol kazan", sub4sub yok. Beğeni/yorum/abonelik istemek serbest.
- **O7 Müzik ve haklar [R]:** Yalnız kendi ürettiğimiz ya da lisanslı müzik/görsel. 1 dakikadan uzun Shorts'ta Content ID talepli müzik yok.
- **O8 Ses seviyesi [R]:** Miks yaklaşık **−14 LUFS, tepe −1 dBTP** (motor son adımda ölçer ve ayarlar); konuşma müziğin üstünde net.
- **O9 Altyazı [R]:** Her videoya doğru Türkçe **SRT** yüklenir; otomatik altyazıya bırakılmaz.
- **O10 Kitle tutarlılığı [R]:** Konu her zaman kanalın nişinden ve aynı kitleden; niş dışı virâl konu kovalanmaz.
- **O11 Silme ve tekrar yükleme yok [R]:** Zayıf video silinmez, aynısı tekrar yüklenmez; başlığı/kapağı yeniden paketlenir. İyi giden videonun paketine dokunulmaz.
- **O12 Etiketler [R]:** En fazla birkaç alakalı etiket (motor sınırı: **6**) ve yaygın yanlış yazılış; etiket doldurma yok.

## 3. Uzun video kuralları
- **U1 3 başlık + 3 kapak [R]:** Senaryoda **`basliklar`: 3 farklı başlık** (her biri ≤50) ve 3 kapak yazısı. Studio'da A/B testi (Test ve Karşılaştır) açılır;
  kazananı izleme süresi payı belirler; test sürerken değiştirilmez. *(API'de yok → video zamanlanmış yüklenir, telefona Studio görevi gelir.)*
- **U2 Başlık [V]:** **En fazla 50 karakter**, ana vaat ilk 40 karakterde.
- **U3 Kapak [R+V]:** **3840×2160**, az yazı, yüz şart değil, sağ alt köşe (süre rozeti) boş, videodaki gerçek bir ana dayanır.
- **U4 İlk 30 saniye [R]:** Video vaatle başlar; logo, jenerik, selamlaşma, uzun tanıtım yok.
- **U5 Uzunluk [R]:** Süreyi hikâye belirler; yapay uzatma yok.
- **U6 Bölümler [R]:** Açıklamada zaman damgaları; ilk **00:00**, **en az 3 bölüm**, her biri **en az 10 sn** (motor render sonrası kontrol eder).
- **U7 Bitiş ekranı [R]:** Son 5–20 sn'de ekranın o alanı boş; ilgili video/oynatma listesi eklenir. *(Studio görevi.)*
- **U8 TV [R]:** 1080p'de 30 px'ten küçük yazı yok; ekran 3 metreden okunur.
- **U9 Seri ve liste [R]:** Her uzun video konusuna uygun bir oynatma listesine eklenir → **`oynatmaListesi` zorunlu**.

## 4. Shorts kuralları
- **S1 İlk kare [R]:** İlk karede konu tek bakışta anlaşılır; ilk cümle konuya doğrudan girer.
- **S2 Format [R]:** 9:16, 1080×1920; yazı ve önemli çizimler sağ düğmelerin ve alt açıklama alanının dışında.
- **S3 Uzunluk [R]:** En fazla 3 dakika; süreyi hikâye belirler (sabit cümle/saniye kuralı yok).
- **S4 İlgili video [R+V]:** Her Shorts'a Studio'dan "İlgili video" bağlantısı (ilgili uzun video) → senaryoda **`ilgiliVideo` zorunlu**
  (uzun videonun iş kimliği ya da YouTube adresi). Bağlantıya yönlendiren **tek çağrı son 5 saniyede**. *(Studio görevi.)*
- **S5 Shorts oranı [V]:** Shorts sayısı toplam yüklemelerin yarısını geçmez (haftalık plan: Shorts ≤ uzun video).
- **S6 Shorts başlığı [V]:** **En fazla 40 karakter.**

## 5. Yayın ve ölçüm
- **Y1 Ritim:** En az haftada 1 uzun video; sabit, sürdürülebilir ritim. Belirli saat kuralı yok.
- **Y2 Sabır:** İlk 50 video deneme dönemi; format 5 videodan önce terk edilmez.
- **Y3 Ölçüm:** Karar kanalın kendi "tipik" aralığıyla kıyasla; ilk 72 saatte karar yok; haftalar–90 gün. Bakılanlar: gösterim TO, ortalama izleme süresi,
  ilk 30 sn tutma, Shorts'ta izlemeyi seçen oranı, geri dönen izleyici, abone kazanımı. Sabit oran hedefi yok.
- **Y4 Yeniden paketleme:** Tipik aralığın altındaki videonun önce başlığı/kapağı değiştirilir; sonuç en az birkaç hafta beklenir.

## 6. Yayın öncesi kontrol listesi (hepsi "evet")
Ortak O1–O12 · Uzun U1–U9 · Shorts S1–S6 · Yayın Y1–Y4. Bir madde "hayır" ise video yayınlanmaz, eksik düzeltilir, liste baştan doldurulur.
Senaryoda **`kontrol`** alanı: her madde için `"evet: nasıl"` (ör. `"O3": "evet: 3 kaynak, kaynaklar alanında"`). Motor eksik/`hayır` maddeyi reddeder.

## 7. Çıktı (aşama aşama)
1. Konu kararı ve doğrulanmış bilgiler (kaynak bağlantılarıyla) → `kaynaklar`.
2. Uzun video: 3 başlık (karakter sayılı) + 3 kapak; tam metin; saniye çizelgesi; bölüm zamanları; bitiş ekranı alanı.
3. Shorts: başlık (karakter sayılı), metin, saniye çizelgesi, ilgili video seçimi (`ilgiliVideo`).
4. Yayın paketi: açıklama, bölümler, etiketler, YZ beyanı, SRT altyazı, oynatma listesi.
5. Bölüm 6 kontrol listesi: her madde için "evet + nasıl" (`kontrol`).

## v4'te KURAL OLMAYANLAR (kanıtı yok; zorunlu tutulmaz)
Her gün aynı saatte yayın · her gün 1 Shorts · sabit karne eşikleri (%4 TO, %70 izlemeyi seçen…) · 7. günde karar ·
her 60–90 sn ara kanca / her 3–6 sn görsel değişim · "ama/bu yüzden" bağlaç kuralı, kurulum→gerilim→ödül şablonu ·
başlık-kapak aynı kelime yasağı · Shorts döngüsü, sabit 40–50 sn ve hızlandırma zorunluluğu · ilk 30 sn'de abone istememe ·
Shorts'ta seçmeli soru kartı · açıklamanın ilk 150 karakteri, dosya adı, #keşfet/#shorts · kapakta yüz · Shorts'u konu testi olarak kullanmak.

> Pratik sonuç: haftalık plan 1 uzun + en fazla 1 Shorts (ya da 2 uzun + 2 Shorts); günlük Shorts planı S5'e aykırı.
