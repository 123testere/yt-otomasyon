// Anahtar gerektirmeyen ücretsiz görsel arşivleri: Wikimedia Commons, Openverse, NASA.
// Yalnızca ticari kullanıma ve düzenlemeye izin veren lisanslar alınır; kaynak gösterilmesi
// gerekenler `credit` olarak döner ve video açıklamasına eklenir.
import { download } from '../lib/util.js';

const UA = { 'User-Agent': 'YTOtomasyon/1.0 (kisisel YouTube otomasyon araci)' };
const BLOCKED_LICENSE = /\b(NC|ND)\b|non-?commercial|no-?deriv|fair use/i;

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function getJson(url, timeoutMs = 30_000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`);
  return res.json();
}

// Önce henüz kullanılmamış sonuçlara, onların ilk 5'i içinde de video formatına en yakın en-boy oranına bakar.
function choose(items, used, fmt) {
  const fresh = items.filter((it) => !used.has(it.key));
  if (!fresh.length) throw new Error('Sonuç yok');
  const target = fmt.w / fmt.h;
  const score = (it) => Math.abs(Math.log((it.width / it.height) / target));
  const chosen = fresh.slice(0, 5).sort((a, b) => score(a) - score(b))[0];
  used.add(chosen.key);
  return chosen;
}

// Arşiv alanlarında HTML olabiliyor (ör. <div class='fn'>); YouTube açıklamada < > kabul etmez.
const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const creditLine = ({ title, author, license, url }) =>
  `"${plain(title)}" – ${plain(author) || 'bilinmeyen yazar'}, ${plain(license)} (${url})`;

export async function wikimedia(query, fmt, dest, used) {
  const width = fmt.portrait ? 1080 : 1920;
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + `&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${width}`;
  const data = await getJson(url);
  const items = Object.values(data.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ p, info: p.imageinfo?.[0] }))
    .filter(({ info }) => info?.thumburl && info.width >= 800)
    .map(({ p, info }) => {
      const meta = info.extmetadata ?? {};
      return {
        key: `w${p.pageid}`,
        width: info.width,
        height: info.height,
        src: info.thumburl,
        license: stripHtml(meta.LicenseShortName?.value) || 'bilinmiyor',
        needsCredit: meta.AttributionRequired?.value !== 'false',
        title: stripHtml(meta.ObjectName?.value) || p.title.replace(/^File:/, ''),
        author: stripHtml(meta.Artist?.value).slice(0, 80),
        page: info.descriptionurl,
      };
    })
    .filter((it) => it.license !== 'bilinmiyor' && !BLOCKED_LICENSE.test(it.license));
  const it = choose(items, used, fmt);
  await download(it.src, dest, { headers: UA });
  return {
    kind: 'image', file: dest,
    credit: it.needsCredit ? creditLine({ title: it.title, author: it.author, license: it.license, url: it.page }) : null,
  };
}

export async function openverse(query, fmt, dest, used) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}`
    + `&license_type=commercial,modification&mature=false&size=large&page_size=20`
    + `&aspect_ratio=${fmt.portrait ? 'tall' : 'wide'}`;
  // Openverse zaman zaman çok yavaş; uzun beklemek yerine kısa sürede vazgeç.
  const data = await getJson(url, 15_000);
  const items = (data.results ?? [])
    .filter((r) => r.url && r.width && r.height)
    .map((r) => ({ ...r, key: `o${r.id}` }));
  const it = choose(items, used, fmt);
  await download(it.url, dest, { headers: UA, timeoutMs: 120_000 });
  const free = ['cc0', 'pdm'].includes(it.license);
  const license = `CC ${it.license.toUpperCase()} ${it.license_version ?? ''}`.trim();
  return {
    kind: 'image', file: dest,
    credit: free ? null : creditLine({ title: it.title || 'Adsız', author: it.creator, license, url: it.foreign_landing_url }),
  };
}

// NASA görselleri kamu malıdır, kaynak göstermek zorunlu değil.
export async function nasa(query, fmt, dest, used) {
  const data = await getJson(`https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(query)}`);
  const items = (data.collection?.items ?? []).slice(0, 15).map((item) => ({
    key: `n${item.data?.[0]?.nasa_id}`,
    manifest: item.href,
    width: 16, height: 9, // NASA aramada boyut vermiyor; oran seçimini etkilemesin
  }));
  const it = choose(items, used, fmt);
  const files = await getJson(it.manifest);
  const src = ['~large.jpg', '~medium.jpg', '~orig.jpg'].map((suffix) => files.find((f) => f.endsWith(suffix))).find(Boolean);
  if (!src) throw new Error('NASA: uygun boyutta dosya yok');
  await download(src.replace(/^http:/, 'https:'), dest, { headers: UA, timeoutMs: 120_000 });
  return { kind: 'image', file: dest, credit: null };
}
