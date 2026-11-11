// "Neden iyi / neden zayıf" teşhisi: her video kanalın kendi ortalamasıyla (aynı türdeki videoların medyanı) karşılaştırılır.
// Saf fonksiyonlar; Firestore'a dokunmaz (optimize.js çağırır, test edilebilir).

const DAY = 86400000;
const MIN_KIYAS = 4; // ortalama için en az bu kadar başka video
const MIN_IZLENME = { short: 100, long: 30 };
const ERKEN_GUN = 3;

export const TRAFIK_ADI = {
  YT_SEARCH: 'YouTube araması', SHORTS: 'Shorts akışı', RELATED_VIDEO: 'önerilen videolar', SUBSCRIBER: 'abone akışı',
  BROWSE: 'ana sayfa', YT_CHANNEL: 'kanal sayfası', EXT_URL: 'dış bağlantılar', PLAYLIST: 'oynatma listeleri',
  NOTIFICATION: 'bildirimler', END_SCREEN: 'bitiş ekranı', YT_OTHER_PAGE: 'diğer YouTube sayfaları', NO_LINK_OTHER: 'doğrudan',
  HASHTAGS: 'etiket sayfaları', SOUND_PAGE: 'ses sayfası', ANNOTATION: 'kartlar', CAMPAIGN_CARD: 'kampanya', SHORTS_CONTENT_LINKS: 'Shorts bağlantıları',
};

export const medyan = (xs) => {
  const s = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const yuzde = (x, digits = 0) => `%${(x * 100).toLocaleString('tr-TR', { maximumFractionDigits: digits })}`;
const yuzdeSayi = (x) => `%${Number(x).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
const sure = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const tarihOf = (v) => new Date(v?.toDate?.() ?? v);
const aboneOran = (p) => (p.izlenme7 > 0 ? (p.abone7 / p.izlenme7) * 1000 : null);

// Kanal ortalamaları (aynı tür, kendisi hariç).
export function kiyas(perfs, p) {
  const peers = perfs.filter((q) => q.youtubeId !== p.youtubeId && q.tip === p.tip && q.izlenme7 > 0);
  if (peers.length < MIN_KIYAS) return null;
  return {
    n: peers.length,
    izlenme7: medyan(peers.map((q) => q.izlenme7)),
    tiklanma7: medyan(peers.map((q) => q.tiklanma7)),
    kancaOran: medyan(peers.map((q) => q.kancaOran)),
    tutma30: medyan(peers.map((q) => q.tutma30)),
    tutma: medyan(peers.map((q) => q.tutma)),
    abone: medyan(peers.map(aboneOran)),
  };
}

// Tutma eğrisindeki en büyük kopuş (ilk %5 sayılmaz: herkes ilk saniyelerde biraz düşer).
export function enBuyukDusus(egri, sureSn) {
  if (!egri?.length || !sureSn) return null;
  let best = null;
  for (let i = 1; i < egri.length; i++) {
    const d = egri[i - 1] - egri[i];
    if (!best || d > best.d) best = { d, i };
  }
  if (!best || best.d < 0.05) return null;
  return { saniye: Math.round(((best.i + 0.5) / egri.length) * sureSn), kayip: best.d };
}

function sahneMetni(job, sahneZaman, sn) {
  if (!job?.scenes?.length || !sahneZaman?.length) return null;
  let idx = 0;
  for (let i = 0; i < sahneZaman.length; i++) if (sahneZaman[i] <= sn) idx = i;
  const sc = job.scenes[idx];
  const text = (sc?.narration ?? (sc?.satirlar ?? []).map((s) => s.metin).join(' '))?.trim();
  return text ? (text.length > 90 ? `${text.slice(0, 87)}…` : text) : null;
}

// Teşhis: { etiket: iyi|normal|zayif|az-veri|erken, oran, nedenler: [{tur, iyi, metin}], oneri }
export function teshis(p, perfs, { job = null, sahneZaman = null, now = new Date() } = {}) {
  const yas = (now.getTime() - tarihOf(p.yayin).getTime()) / DAY;
  const k = kiyas(perfs, p);
  const nedenler = [];
  const ekle = (tur, iyi, metin) => nedenler.push({ tur, iyi, metin });

  if (p.izlenme7 < MIN_IZLENME[p.tip]) {
    return { etiket: yas < ERKEN_GUN ? 'erken' : 'az-veri', oran: null, nedenler: [], oneri: null };
  }
  const oran = k?.izlenme7 ? p.izlenme7 / k.izlenme7 : null;
  let etiket = oran == null ? 'normal' : oran >= 1.5 ? 'iyi' : oran <= 0.6 ? 'zayif' : 'normal';
  if (yas < ERKEN_GUN) etiket = 'erken';

  if (k) {
    if (p.tiklanma7 != null && k.tiklanma7) {
      const r = p.tiklanma7 / k.tiklanma7;
      if (r <= 0.7) ekle('kapak', false, `Tıklanma ${yuzdeSayi(p.tiklanma7)} (kanal ortalaması ${yuzdeSayi(k.tiklanma7)}): kapak ve başlık izleyiciyi çekmedi.`);
      else if (r >= 1.3) ekle('kapak', true, `Tıklanma ${yuzdeSayi(p.tiklanma7)} (ortalama ${yuzdeSayi(k.tiklanma7)}): kapak ve başlık işe yaradı.`);
    }
    if (p.tip === 'short' && p.kancaOran != null && k.kancaOran) {
      const r = p.kancaOran / k.kancaOran;
      if (r <= 0.85) ekle('kanca', false, `İzlemeyi seçen ${yuzde(p.kancaOran)} (ortalama ${yuzde(k.kancaOran)}): ilk saniyelerde kaydırılıyor, kanca zayıf.`);
      else if (r >= 1.15) ekle('kanca', true, `İzlemeyi seçen ${yuzde(p.kancaOran)} (ortalama ${yuzde(k.kancaOran)}): açılış güçlü.`);
    }
    if (p.tip === 'long' && p.tutma30 != null && k.tutma30) {
      const r = p.tutma30 / k.tutma30;
      if (r <= 0.85) ekle('kanca', false, `İlk 30 saniyede kalan ${yuzde(p.tutma30)} (ortalama ${yuzde(k.tutma30)}): giriş zayıf.`);
      else if (r >= 1.15) ekle('kanca', true, `İlk 30 saniyede kalan ${yuzde(p.tutma30)} (ortalama ${yuzde(k.tutma30)}): giriş güçlü.`);
    }
    if (p.tutma != null && k.tutma) {
      const r = p.tutma / k.tutma;
      if (r <= 0.8) {
        const d = enBuyukDusus(p.egri, p.sure);
        const sahne = d ? sahneMetni(job, sahneZaman, d.saniye) : null;
        ekle('tutma', false, `Ortalama izlenme ${yuzdeSayi(p.tutma)} (kanal ortalaması ${yuzdeSayi(k.tutma)}): izleyici videonun ortasında kopuyor.`
          + (d ? ` En büyük kopuş ${sure(d.saniye)} civarında${sahne ? `: “${sahne}”` : ''}.` : ''));
      } else if (r >= 1.2) {
        ekle('tutma', true, `Ortalama izlenme ${yuzdeSayi(p.tutma)} (ortalama ${yuzdeSayi(k.tutma)}): izleyici sonuna kadar kaldı.`);
      }
    }
    const ab = aboneOran(p);
    if (ab != null && k.abone != null && p.abone7 >= 3 && ab >= Math.max(1, k.abone * 2)) {
      ekle('abone', true, `1000 izlenmede ${ab.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} abone (ortalama ${k.abone.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}): kanala bağladı.`);
    }
  }

  const trafik = Object.entries(p.trafik ?? {});
  const toplam = trafik.reduce((n, [, v]) => n + v, 0);
  if (toplam > 0) {
    const [ust, v] = trafik.sort((a, b) => b[1] - a[1])[0];
    const arama = (p.trafik.YT_SEARCH ?? 0) / toplam;
    if (arama >= 0.35) ekle('trafik', true, `Aramadan gelen izlenme ${yuzde(arama)}: başlıktaki anahtar kelime işe yaradı.`);
    // Shorts zaten neredeyse tamamen Shorts akışından gelir; bu bilgi yalnızca uzun videoda ya da farklı kaynakta anlamlı.
    else if (['iyi', 'zayif'].includes(etiket) && !(p.tip === 'short' && ust === 'SHORTS')) {
      ekle('trafik', etiket === 'iyi', `En çok izlenme kaynağı: ${TRAFIK_ADI[ust] ?? ust} (${yuzde(v / toplam)}).`);
    }
  }

  const kotu = nedenler.filter((n) => !n.iyi);
  const iyi = nedenler.filter((n) => n.iyi);
  if (etiket === 'zayif' && !kotu.length) {
    ekle('konu', false, 'Kapak, kanca ve izlenme süresi normal: video az kişiye gösterilmiş. Sorun büyük olasılıkla konu ya da yayın saati.');
  }
  if (etiket === 'iyi' && !iyi.length) ekle('konu', true, 'Konu ilgi gördü: video ortalamanın üstünde gösterildi.');

  const ana = kotu[0]?.tur ?? (etiket === 'zayif' ? 'konu' : null);
  const oneri = etiket === 'zayif' || kotu.length ? {
    kapak: p.tip === 'long' ? 'Kapak yedek yazıyla otomatik denenecek; tıklanma düzelmezse başlık değişecek.' : 'Başlık ve ilk kare daha merak uyandırıcı olmalı.',
    kanca: 'Sonraki videolarda ilk cümle daha güçlü bir kanca olmalı (şaşırtıcı bilgi ya da doğrudan soru).',
    tutma: 'Kopuşun olduğu yerdeki anlatım kısaltılmalı, tempo artırılmalı.',
    konu: 'Benzer konular yerine farklı bir açı denenmeli; arama terimlerine bak.',
  }[ana] ?? null : null;

  return { etiket, oran: oran == null ? null : Math.round(oran * 100) / 100, nedenler, oneri };
}

// Pazartesi raporu (otomatik): son 14 günün videoları. Claude rutini bunun üstüne yorumlu özet ve dersler yazar.
export function haftalikOzet(perfs, now = new Date()) {
  const son = perfs.filter((p) => {
    const yas = (now.getTime() - tarihOf(p.yayin).getTime()) / DAY;
    return yas <= 14 && p.teshis && !['erken', 'az-veri'].includes(p.teshis.etiket);
  });
  const say = (e) => son.filter((p) => p.teshis.etiket === e).length;
  const satirlar = [];
  if (!son.length) return { satirlar: ['Son 14 günde değerlendirilecek kadar izlenen video yok.'], iyi: 0, zayif: 0, normal: 0 };
  satirlar.push(`Son 14 günde ${son.length} video değerlendirildi: ${say('iyi')} iyi, ${say('normal')} normal, ${say('zayif')} zayıf.`);
  const sirali = [...son].sort((a, b) => (b.teshis.oran ?? 0) - (a.teshis.oran ?? 0));
  const enIyi = sirali[0];
  if (enIyi?.teshis.etiket === 'iyi') {
    satirlar.push(`En iyisi “${enIyi.baslik}” (ortalamanın ${enIyi.teshis.oran.toLocaleString('tr-TR', { maximumFractionDigits: enIyi.teshis.oran >= 10 ? 0 : 1 })} katı). ${enIyi.teshis.nedenler.find((n) => n.iyi)?.metin ?? ''}`.trim());
  }
  const enKotu = sirali.at(-1);
  if (enKotu?.teshis.etiket === 'zayif') {
    satirlar.push(`En zayıfı “${enKotu.baslik}”. ${enKotu.teshis.nedenler.find((n) => !n.iyi)?.metin ?? ''}`.trim());
  }
  // En sık görülen sorun
  const sorunlar = {};
  for (const p of son) for (const n of p.teshis.nedenler.filter((x) => !x.iyi)) sorunlar[n.tur] = (sorunlar[n.tur] ?? 0) + 1;
  const [sik, adet] = Object.entries(sorunlar).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (adet >= 2) {
    satirlar.push({
      kapak: `${adet} videoda tıklanma düşük: kapak ve başlıklar güçlendirilmeli.`,
      kanca: `${adet} videoda açılış zayıf: izleyici ilk saniyelerde gidiyor.`,
      tutma: `${adet} videoda izleyici ortada kopuyor: anlatım sıkılaştırılmalı.`,
      konu: `${adet} video az gösterildi: konu seçimi gözden geçirilmeli.`,
    }[sik]);
  }
  return { satirlar, iyi: say('iyi'), zayif: say('zayif'), normal: say('normal') };
}
