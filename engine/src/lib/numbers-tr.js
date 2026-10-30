// Seslendirme öncesi Türkçe metindeki sayıları okunuşlarına çevirir ("1096'da" → "bin doksan altıda").
// Altyazılar orijinal metinden üretildiği için ekranda rakamlar aynen kalır.
const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const SCALES = [[1e12, 'trilyon'], [1e9, 'milyar'], [1e6, 'milyon'], [1e3, 'bin']];
const ORDINALS = {
  sıfır: 'sıfırıncı', bir: 'birinci', iki: 'ikinci', üç: 'üçüncü', dört: 'dördüncü', beş: 'beşinci',
  altı: 'altıncı', yedi: 'yedinci', sekiz: 'sekizinci', dokuz: 'dokuzuncu', on: 'onuncu', yirmi: 'yirminci',
  otuz: 'otuzuncu', kırk: 'kırkıncı', elli: 'ellinci', altmış: 'altmışıncı', yetmiş: 'yetmişinci',
  seksen: 'sekseninci', doksan: 'doksanıncı', yüz: 'yüzüncü', bin: 'bininci', milyon: 'milyonuncu',
  milyar: 'milyarıncı', trilyon: 'trilyonuncu',
};

function under1000(n) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  return [h ? (h === 1 ? 'yüz' : `${ONES[h]} yüz`) : '', TENS[t], ONES[o]].filter(Boolean).join(' ');
}

export function spellInt(n) {
  if (n === 0) return 'sıfır';
  const out = [];
  let rest = n;
  for (const [value, name] of SCALES) {
    const q = Math.floor(rest / value);
    if (q) {
      out.push(value === 1e3 && q === 1 ? 'bin' : `${spellInt(q)} ${name}`);
      rest %= value;
    }
  }
  if (rest) out.push(under1000(rest));
  return out.join(' ');
}

function spellOrdinal(n) {
  const words = spellInt(n).split(' ');
  words[words.length - 1] = ORDINALS[words.at(-1)] ?? words.at(-1);
  return words.join(' ');
}

// "1.500,25" → { int: 1500, frac: "25" }
function parse(raw) {
  const [intPart, frac] = raw.replace(/\.(?=\d{3}\b)/g, '').split(',');
  return { int: Number(intPart), frac };
}

function spellNumber(raw) {
  const { int, frac } = parse(raw);
  if (!Number.isFinite(int)) return raw;
  const whole = spellInt(int);
  if (!frac) return whole;
  const fracWords = /^0+/.test(frac) ? [...frac].map((d) => spellInt(Number(d))).join(' ') : spellInt(Number(frac));
  return `${whole} virgül ${fracWords}`;
}

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`;

export function spellNumbersTr(text) {
  return text
    // Aralıklar: 1914-1918 → 1914 ile 1918
    .replace(new RegExp(`(${NUM})\\s?[-–]\\s?(${NUM})`, 'g'), '$1 ile $2')
    // Yüzdeler: %50 → yüzde elli, %40'ı → yüzde kırkı
    .replace(new RegExp(`%\\s?(${NUM})(?:['’](\\p{L}+))?`, 'gu'), (_, n, suffix = '') => `yüzde ${spellNumber(n)}${suffix}`)
    // Sıra sayıları: "15. yüzyıl" (küçük harfle devam) veya "2. Dünya Savaşı" (1000'den küçük, büyük harfle devam).
    // "Yıl 2026. Sonra" gibi cümle sonları sıra sayısı sayılmaz.
    .replace(/\b(\d+)\.(?=\s+(\p{Ll}|\p{Lu}))/gu, (m, n, next) =>
      (next === next.toLocaleLowerCase('tr') || Number(n) < 1000 ? spellOrdinal(Number(n)) : m))
    // Ek almış sayılar: 1325'te → bin üç yüz yirmi beşte
    .replace(new RegExp(`(${NUM})['’](\\p{L}+)`, 'gu'), (_, n, suffix) => `${spellNumber(n)}${suffix}`)
    .replace(new RegExp(NUM, 'g'), (n) => spellNumber(n));
}
