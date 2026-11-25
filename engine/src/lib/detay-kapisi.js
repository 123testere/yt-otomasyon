// "Söylenen nesne ekranda görünür" kapısı (kullanıcı kuralı 2026-11-25). Dizi dosyasında "detayKapisi": true ise çalışır.
// Anlatımda geçen eşya/takı sahnenin verisinde yoksa video üretilmez; küçük ayrıntılar en az bir kez yakın planda gösterilir.
// Ekranda gerçekten olmayan (anı, mecaz) bir söz için sahneye: "anilan": {"bilezik": "neden görünmüyor"} (videoda en fazla 3).
const kok = (s) => new RegExp(`(?<!\\p{L})(?:${s})`, 'u');
// Başka kelimeyle karışan kısa kökler yalnız ad çekimiyle aranır (kova ≠ kovaladı, kese ≠ kesen)
const tam = (s) => new RegExp(`(?<!\\p{L})(?:${s})(?:y[ıiae]|n[ıi]n|s[ıi]\\p{L}*|d[ae]n?|l[ae]r\\p{L}*)?(?!\\p{L})`, 'u');

export const DETAYLAR = [
  { ad: 'testi', re: kok('testi'), esya: ['testi'], nesne: ['testi', 'kirik-testi'], yakin: true },
  { ad: 'kova', re: tam('kova'), esya: ['kova'], nesne: ['kova'] },
  { ad: 'sepet', re: kok('sepet'), esya: ['sepet'], nesne: ['sepet'] },
  { ad: 'tepsi', re: kok('tepsi'), esya: ['tepsi'], nesne: ['tepsi'] },
  { ad: 'mektup', re: kok('mektu[pb]'), esya: ['mektup'], nesne: ['mektup'], yakin: true },
  { ad: 'kese', re: tam('kese'), esya: ['kese'], nesne: ['kese'] },
  { ad: 'şişe', re: kok('şişe(?!l)'), esya: ['sise'], nesne: ['sise'], yakin: true },
  { ad: 'kitap', re: kok('kita[pb]'), esya: ['kitap'], nesne: ['kitap'] },
  { ad: 'ekmek', re: kok('ekme[kğ]'), esya: ['ekmek'], nesne: ['ekmek'] },
  { ad: 'çiçek', re: kok('çiçe[kğ]'), esya: ['cicek'], nesne: ['cicek'] },
  { ad: 'bilezik', re: kok('bilezi[kğ]'), taki: ['bilezik', 'yarim-bilezik'], nesne: ['bilezik', 'yarim-bilezik'], yakin: true },
  { ad: 'yüzük', re: kok('yüzü[kğ](?!oyun)'), taki: ['yuzuk'], yakin: true },
  { ad: 'kolye', re: kok('kolye'), taki: ['kolye'], yakin: true },
  { ad: 'anahtar', re: kok('anahtar'), esya: ['anahtar'], nesne: ['anahtar'], yakin: true },
  { ad: 'kılıç', re: kok('kılı[çc]'), esya: ['kilic', 'kilic+kalkan', 'tahta-kilic'], nesne: ['kilic'] },
  { ad: 'kalkan', re: kok('kalkan(?:[ıi]|l[ae]r|\\P{L}|$)'), esya: ['kalkan', 'kilic+kalkan'], nesne: ['kalkan', 'kirik-kalkan'] },
  { ad: 'meşale', re: kok('meşale'), esya: ['mesale'], mekan: ['zindan', 'merdiven', 'mahzen', 'sur', 'kanal'] },
  { ad: 'fener', re: kok('fener'), esya: ['fener'] },
  { ad: 'zincir', re: kok('zincir(?!li)'), taki: ['kelepce'], zincir: true },
  { ad: 'dökülen su / damla', re: /(?<!\p{L})su(?:yu|lar)?(?!\p{L})[^.!?]{0,20}dökül|su damla/u, nesne: ['su-birikintisi', 'su-damlasi'] },
];

function gorunur(d, sc, dizi) {
  if (d.mekan?.includes(sc.mekan)) return true;
  if ((sc.nesneler ?? []).some((n) => d.nesne?.includes(n.tip))) return true;
  if (d.zincir && (sc.zincir || sc.duvarZincir?.length)) return true;
  return (sc.kadraj ?? []).some((k) => {
    const def = dizi.karakterler?.[k.id] ?? {};
    const esyalar = [k.esya !== undefined ? k.esya : def.esya, ...(k.adimlar ?? []).map((a) => a.esya)];
    const takilar = k.takilar ?? def.takilar ?? [];
    return esyalar.some((x) => d.esya?.includes(x)) || takilar.some((x) => d.taki?.includes(x))
      || Boolean(d.zincir && (def.zincir || [k.poz, ...(k.adimlar ?? []).map((a) => a.poz)].includes('zincirli')));
  });
}

export function detayHatalari(job, dizi) {
  const errors = [];
  const ister = new Set();
  const gosterildi = new Set();
  let anilan = 0;
  let yakinSayi = 0;
  (job.scenes ?? []).forEach((sc, i) => {
    yakinSayi += sc.yakinPlan?.length ?? 0;
    const metin = (sc.satirlar ?? []).map((s) => s?.metin ?? '').join(' ').toLocaleLowerCase('tr');
    for (const d of DETAYLAR) {
      if (!d.re.test(metin)) continue;
      if (sc.anilan?.[d.ad]) {
        anilan++;
        if (String(sc.anilan[d.ad]).length < 8) errors.push(`sahne ${i + 1}: anilan.${d.ad} için neden yaz`);
      } else if (!gorunur(d, sc, dizi)) {
        errors.push(`sahne ${i + 1}: anlatımda "${d.ad}" geçiyor ama ekranda yok: ${[d.esya && 'esya', d.taki && 'takilar', d.nesne && 'nesneler'].filter(Boolean).join(' / ')} ile göster`);
      } else if (d.yakin) {
        ister.add(d.ad);
        if (sc.yakinPlan?.length) gosterildi.add(d.ad);
      }
    }
  });
  for (const ad of ister) if (!gosterildi.has(ad)) errors.push(`"${ad}" küçük bir ayrıntı: geçtiği sahnelerden en az birine yakinPlan ekle (kamera ona yaklaşsın)`);
  if (anilan > 3) errors.push(`anilan ${anilan} yerde kullanılmış; en fazla 3 (nesneyi göstermeyi tercih et)`);
  const enAz = job.type === 'long' ? 4 : 1;
  if (yakinSayi < enAz) errors.push(`en az ${enAz} yakinPlan olmalı (${yakinSayi} var): dönüm noktası ayrıntıları ve yüz tepkileri yakından görünsün`);
  return errors;
}
