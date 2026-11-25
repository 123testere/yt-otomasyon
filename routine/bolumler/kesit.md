## Uzun videodan kesit Shorts (`needed.json` öğesinde `clipOf` varsa; dizi formatında değil)

Bu Shorts bağımsız değildir; `clipOf` id'li uzun videonun bir bölümünden kurgulanır ve izleyiciyi uzun videoya çağırır.
- Kaynak senaryoyu `queue/<clipOf>.json` ya da `done/<clipOf>.json` içinde oku. Kaynak da bu turda yazılacaksa (`needed.json`'da) **önce onu yaz**.
- Aynı uzun videodan daha önce çıkmış kesitleri bul (`queue/` ve `done/` içinde `derivedFrom` değeri aynı olanlar) ve **farklı bir bölüm** seç: kendi başına anlaşılır, en çarpıcı bilgi ya da hikâye.
- Dosyaya `"derivedFrom": "<clipOf>"` yaz.
- Anlatım büyük ölçüde uzun videonun cümlelerinden gelir (doğrulayıcı kelimelerin en az %60'ının kaynakta geçmesini ister). Shorts'a uysun diye kısaltabilir, sırasını değiştirebilirsin.
- İlk cümle yeni bir kanca olabilir. Son cümle hikâyenin tamamının kanaldaki uzun videoda olduğunu söyler ve izleyiciye seçmeli bir soru sorar. Açıklamaya bağlantıyı motor ekler.
- Başlık kesite özgü ve yeni olsun, uzun videonun başlığını tekrar etme. `hookText` yaz.
- Görsel alanları ve hareketli grafikler normal kurallara göre yazılır; uzun videodaki uygun `visual.query` değerlerini yeniden kullanabilirsin.
