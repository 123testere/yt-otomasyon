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
- `baslikKart`: Shorts'ta üstte, uzun videoda girişte duran iki satırlık başlık (her satır ≤22 karakter); ikinci satır lamba renginde vurgulanır. **İlk sahnenin çizimi ilk karede tamamen çizilmiş görünür** (motor böyle oynatır): ilk sahneyi videonun en çarpıcı görüntüsü yap.
- `rozet`: Ekranın üstünde seri rozeti (≤32), ör. "Eşyaların Hikâyesi #54" ya da seri bölümünde "Markaların Hikâyesi #3". Merak uyandıran soru: `["Simidin ortası", "neden delik?"]`.
- `kapanis` (Shorts, zorunlu). İki tür: **kişisel soru kartı** `{"soru": "Sizin evde hâlâ var mı?", "alt": "Yorumlara yaz"}` (soru ≤60; izleyicinin anısını ya da fikrini soran, tek cümle; kanal talimatı istiyorsa bunu kullan, Lamba Altında bunu kullanır) ya da oylama kartı (`routine/bolumler/oylama.md`): Son sahnede çıkan seçmeli soru kartı: `{"soru": "Sırada hangisi olsun?", "a": "Saat", "b": "Petek"}` (a ve b ≤18, soru ≤30). Kartın altında "abone ol ve beğen" yazısı kendiliğinden çıkar. Son sahnenin anlatımı bu soruyu sorar ve abone + beğen çağrısını yapar; son sahneye çizim olarak `txt('?', MX, 420, 200, { c: K.ak })` yeter.
- Uzun video: İlk sahneler **giriş**tir (gece zemininde, `baslikKart` başlığıyla). Her bölümün ilk sahnesine `"bolum": {"no": "Bölüm I", "ust": "1840'lar – 1870'ler", "ad": "Konuşamayan tel"}` yaz (ad ≤32). İlk sahnede `bolum` olmaz. 5-7 bölüm.
- Uzun video başlığı belgesel kalıbında olmaz ("Çamaşır Makinesi: … Nasıl Bitti?" ✗); izleyicinin günlük hayatına dokunan soru ya da zıtlık: "Bu Alet Olmasaydı Günde 8 Saat Çamaşır Yıkıyordunuz" ✓, "Terazi Neden Hiç Yalan Söylemez?" ✓.
- Uzun video kapağı: `thumbnailText` (en fazla 3 kelime, merak: "ÖLÜMCÜL İCAT", "HAFTADA 1 GÜN"; ilk satır lamba renginde), `kapakAlt` (isteğe bağlı küçük italik satır: "İstanbul · 1886–1908") ve `kapakCizim`: **300 × 420** alanında, kalın çizgili (`w: 8`) tek nesne (ör. üstü çizili telefon). Kapakta çizim kendiliğinden kâğıt renginde çizilir.

**Kesit Shorts'ta:** Kaynak uzun videonun sahnelerindeki `cizim` kodlarını aynen kopyalayabilirsin; alan ölçüsü aynıdır.
