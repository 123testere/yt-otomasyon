// Güncel haber akışı (bağımlılıksız): güvenilir kaynakların RSS/Atom akışlarından son 48 saatin haberleri.
// "Haber kanalı" ayarlı kanallar (settings.haberAkisi) için config/haberler-<akış>.json yazılır;
// senaryo yazarı konuyu buradan seçer, kaynak bağlantısını videoya ekler (uydurma haber riski kalmaz).
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, DONE_DIR, QUEUE_DIR } from './paths.js';

const SAAT = 60 * 60 * 1000;
const PENCERE = 48 * SAAT;

// Türkçe genel teknoloji akışlarından sadece yapay zekâ haberleri alınır.
const YZ_KELIMELER = /yapay zek|\bai\b|chatgpt|openai|gemini|anthropic|claude|copilot|llm|dil modeli|nvidia|deepmind|grok|mistral|robot/i;

export const AKISLAR = {
  'yapay-zeka': [
    { ad: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
    { ad: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
    { ad: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
    { ad: 'Ars Technica', url: 'https://arstechnica.com/ai/feed/' },
    { ad: 'Wired', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
    { ad: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
    { ad: 'Google', url: 'https://blog.google/technology/ai/rss/' },
    { ad: 'Webtekno', url: 'https://www.webtekno.com/rss.xml', filtre: YZ_KELIMELER },
    { ad: 'DonanımHaber', url: 'https://www.donanimhaber.com/rss/tum/', filtre: YZ_KELIMELER },
  ],
};

export const haberDosyasi = (akis) => path.join(CONFIG_DIR, `haberler-${akis}.json`);

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function temiz(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITY[e.toLowerCase()] ?? m;
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const etiket = (blok, ...adlar) => {
  for (const ad of adlar) {
    const m = blok.match(new RegExp(`<${ad}(?:\\s[^>]*)?>([\\s\\S]*?)</${ad}>`, 'i'));
    if (m) return m[1];
  }
  return '';
};

// RSS <item> ve Atom <entry> öğelerini ayrıştırır.
export function ayristir(xml, kaynak) {
  const bloklar = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return bloklar.map((b) => {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const link = temiz(etiket(b, 'link')) || atomLink || temiz(etiket(b, 'guid'));
    const tarih = Date.parse(temiz(etiket(b, 'pubDate', 'published', 'updated', 'dc:date')));
    return {
      baslik: temiz(etiket(b, 'title')),
      link,
      kaynak,
      tarih: Number.isNaN(tarih) ? null : new Date(tarih).toISOString(),
      ozet: temiz(etiket(b, 'description', 'summary', 'content')).slice(0, 400),
    };
  }).filter((h) => h.baslik && /^https?:\/\//.test(h.link) && h.tarih);
}

// Daha önce videosu yapılmış haberler (queue/ ve done/ içindeki kaynakLink) işaretlenir.
function kullanilanlar() {
  const set = new Set();
  for (const dir of [QUEUE_DIR, DONE_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (j.kaynakLink) set.add(j.kaynakLink);
      } catch { /* bozuk dosya */ }
    }
  }
  return set;
}

export async function haberleriTopla(akis, { now = new Date(), log = console.log } = {}) {
  const kaynaklar = AKISLAR[akis];
  if (!kaynaklar) throw new Error(`bilinmeyen haber akışı: ${akis}`);
  const hepsi = [];
  for (const k of kaynaklar) {
    try {
      const res = await fetch(k.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; haber-toplayici/1.0)' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const liste = ayristir(await res.text(), k.ad)
        .filter((h) => now - Date.parse(h.tarih) <= PENCERE && Date.parse(h.tarih) <= now.getTime() + SAAT)
        .filter((h) => !k.filtre || k.filtre.test(`${h.baslik} ${h.ozet}`));
      hepsi.push(...liste);
    } catch (e) {
      log(`  haber kaynağı alınamadı (${k.ad}): ${e.message}`);
    }
  }
  const kullanildi = kullanilanlar();
  const gorulen = new Set();
  const haberler = hepsi
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
    .filter((h) => {
      const anahtar = h.baslik.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 60);
      if (gorulen.has(anahtar)) return false;
      gorulen.add(anahtar);
      return true;
    })
    .slice(0, 60)
    .map((h) => ({ ...h, kullanildi: kullanildi.has(h.link) }));
  const veri = { akis, guncellendi: now.toISOString(), pencereSaat: PENCERE / SAAT, haberler };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(haberDosyasi(akis), `${JSON.stringify(veri, null, 2)}\n`);
  return veri;
}

// Açık kanalların istediği akışları tazeler (kanal ayarı: settings.haberAkisi).
export async function akislariTazele(channels, opts = {}) {
  const akislar = [...new Set(channels.filter((c) => c.enabled && c.settings?.haberAkisi).map((c) => c.settings.haberAkisi))];
  for (const a of akislar) {
    const v = await haberleriTopla(a, opts);
    (opts.log ?? console.log)(`Haber akışı "${a}": ${v.haberler.length} haber (son ${v.pencereSaat} saat).`);
  }
}

export function haberLinkleri(akis) {
  try {
    return new Set(JSON.parse(fs.readFileSync(haberDosyasi(akis), 'utf8')).haberler.map((h) => h.link));
  } catch {
    return null;
  }
}
