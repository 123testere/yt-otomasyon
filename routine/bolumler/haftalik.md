## Haftalık rapor (`config/performans.json`)

`node engine/src/rutin-ozet.js analiz` (kaynak `config/performans.json`) her kanalın son videolarının ölçülerini ve otomatik teşhisini içerir. Bir kanalda `raporGerekli: true` ise o kanal için `analiz/<channelId>.json` yaz (varsa üzerine yaz):
```json
{ "hafta": "<performans.json'daki hafta>", "ozet": ["3-5 madde"], "dersler": ["0-3 yeni kural"] }
```
- `ozet`: Uygulamada görünen yorumlu rapor, Türkçe. Ham sayıları tekrarlamak yerine **nedenini** söyle: hangi videolar neden iyi/zayıf gitti, iyi gidenlerin ortak noktası ne (konu türü, kanca kalıbı, başlık kalıbı, Türkiye bağlantısı), zayıfların ortak sorunu ne. Her madde 1-2 cümle. Süren deneyin durumuna ve arama terimlerine değin.
- **Sahne analizi** (`sahneAnalizi.short` / `.long`, `yeterli: true` ise): `enCokKaybettiren` (o tür sahnede izleyici kanal ortalamasından `oran` kat hızlı gidiyor) ve `enIyiTutan` listeleri, `kanca` (kısa/uzun ilk sahnede 3. saniye tutması). Bunlardan **içerik** dersi çıkar: ör. "Uzun cümleli sahneler 1,4 kat izleyici kaybettiriyor: Shorts'ta sahne başına en fazla 12 kelime", "Dev rakam yazılı sahneler en iyi tutan tür: her Shorts'ta en az 2 tane". Kimliğe dokunma (karakter yerine sahne/cümle/tempo/yapı).
- **Haftada en fazla bir büyük içerik değişikliği** (süre, yapı, tempo): sistem izlenme iki hafta üst üste düşerse son eklenen kuralı kendisi geri alır; çok kural birden eklersen hangisinin işe yaradığı anlaşılmaz.
- `dersler`: Veriden **açıkça** çıkan, senaryo yazarken uygulanabilir yeni kurallar (ör. "Mutfak eşyası konuları teknoloji konularından iki kat izleniyor: haftada en az iki mutfak konusu seç."). Tek videoya bakarak ders çıkarma; en az 2-3 videonun desteklediği örüntüler. `dersler` listesinde zaten olanı tekrar yazma. Emin değilsen boş bırak.
- Videolar `etiket: "az-veri"` ya da `"erken"` ise onlar hakkında hüküm verme.
