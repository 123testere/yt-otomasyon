## Seri bölümleri (`needed.json` öğesinde `seri`: { id, ad, no })

Bazı kanallarda bazı videolar bir serinin numaralı bölümüdür (ör. Lamba Altında → **Markaların Hikâyesi**: Salı uzun video, aynı sabah ön gösterim Shorts'u, Perşembe ve Cumartesi 14:00 Shorts). Dosyaya şunları yaz (doğrulayıcı kontrol eder):
- `"seri": "<seri.id>"`, ekrandaki rozet `"rozet": "<seri.ad> #<seri.no>"` (ör. "Markaların Hikâyesi #3"); uzun videoda `"oynatmaListesi": "<seri.ad>"`; açıklamanın ilk satırı rozetle aynı.
- Aynı serinin önceki bölümlerini `queue/` ve `done/` içinde (`seri` alanı aynı olanlar) bul; aynı markayı tekrarlama. Ön gösterim Shorts'u kendi uzun videosunun markasını anlatır.

**Markaların Hikâyesi (`seri.id` = "markalar"):** Bir markanın gerçek hikâyesi: kuruluş anı (kim, nerede, hangi yıl, hangi sorunla), kriz ya da rekabet, dönüm noktası, bugünü. Önce Türk markaları (Eti, Ülker, Arçelik, Beko, Vestel, Pınar, Tamek, Koska, Hacı Bekir, Çaykur, Tofaş, Anadol, Kent, LC Waikiki, Mavi, Migros, Turkcell, THY…), arada dünya markaları (Coca-Cola, Nokia, Kodak, LEGO, Nintendo…). İnsanların **arayacağı** başlık: markanın adı ilk kelimelerde + merak ("Eti Nasıl Kuruldu? Eskişehir'deki Küçük Fırının Sırrı | Markaların Hikâyesi"; Shorts: "Ülker'in İlk Ürünü Bisküvi Değildi").
- Uzun bölüm 5-7 dakika (`targetWords`); 4-6 bölümlü (Kuruluş · Kriz · Dönüm noktası · Bugün). Açılış yine hikâyenin en gerilimli anından (iflasın eşiği, yangın, rakibin hamlesi).
- **Doğruluk ve hukuk:** yalnızca doğrulanabilir tarih, kişi ve olay; emin olmadığını "kaynaklara göre" ile söyle; markayı küçük düşüren, kanıtsız iddia yok; reklam gibi övgü de yok. **Logo çizme**, marka yazısını taklit etme: ürünü ve fabrikayı genel hatlarıyla çiz (bisküvi paketi, fabrika bacası, kamyon).
- Shorts: hızlı Shorts kuralı; markanın en şaşırtıcı tek bilgisi (sorun → cevap), son cümle döngüye bağlanır.
