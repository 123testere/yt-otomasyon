// Masal formatı (Dodi EN + DodiTr TR) kapısı ve ikiz iş üretimi. Şema: routine/bolumler/masal.md
import fs from 'node:fs';
import path from 'node:path';

const MEKAN = ['cayir', 'yaprak', 'dere', 'gol', 'gok', 'kis'];
const ZAMAN = ['gun', 'aksam', 'gece', 'safak'];
const AKTOR = ['pitpit', 'anne', 'lale', 'balik', 'kurbaga', 'salyangoz', 'gunes', 'ruzgar', 'fener', 'baykus', 'kartane'];
const NESNE = ['soru', 'isim', 'baslik', 'kalp', 'nota', 'etiket', 'parilti', 'ses', 'ok', 'ampul', 'sicrama', 'kabarcik', 'bas', 'ucurtma', 'carpi', 'yusufcuk', 'saat', 'isik', 'dusunce', 'elmas', 'isinlar', 'tuy', 'dongu', 'el', 'zz', 'ay', 'gokkusagi', 'prizma', 'birikinti', 'damlalar', 'kardanadam'];
const EFEKT = ['yagmur', 'ruzgar', 'simsek', 'buhar', 'atesbocekleri', 'yildizlar', 'kuslar', 'kar'];
const MUZIK = ['dreamy-flashback', 'carefree', 'meditation-impromptu-01'];
// Anahtar alanları: "ingilizce kelime|türkçe kelime" (sahnedeki sözde geçmeli)
const ANAHTAR = ['at', 'gir', 'cik', 'yas', 'titre', 'kucul', 'hafif', 'isin', 'bitir', 'kol', 'don', 'salin', 'nefes', 'sar', 'genis'];
const CAGRI = /\b(abone|takip et|beğen|yorum|subscribe|follow|like|comment)/i;

const sade = (x) => String(x).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');
const kelimeSay = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

function anahtarlar(sc) {
  const k = [];
  JSON.stringify(sc, (ad, v) => {
    if (ANAHTAR.includes(ad) && typeof v === 'string') k.push(v);
    if (ad === 'z' && typeof v === 'string' && !ZAMAN.includes(v)) k.push(v);
    if (['z', 'say', 'renk'].includes(ad) && Array.isArray(v)) k.push(...v.filter((x) => typeof x === 'string'));
    if (['git', 'i2', 'z2', 'isik'].includes(ad) && Array.isArray(v)) k.push(...v.filter((x) => typeof x === 'string' && x.includes('|')));
    return v;
  });
  return k;
}
const geciyor = (metin, kk) => {
  const ws = String(metin).split(/\s+/).map(sade), p = kk.split(' ').map(sade);
  return ws.some((_, j) => p.every((x, m) => (ws[j + m] ?? '').startsWith(x)));
};

export function masalHatalari(job) {
  const e = [], H = job.hikaye, uzun = job.type === 'long';
  if (!H || !Array.isArray(H.sahneler)) return ['hikaye { baslik:{en,tr}, sahneler:[...] } eksik (routine/bolumler/masal.md)'];
  if (!(H.baslik?.en && H.baslik?.tr)) e.push('hikaye.baslik.en ve .tr yaz');
  const S = H.sahneler, n = S.length;
  if (uzun ? n < 50 || n > 130 : n < 4 || n > 9) e.push(`sahne sayısı ${n}: uzun masal 50-130, Shorts 4-9 sahne`);
  const enK = S.reduce((a, s) => a + kelimeSay(s.en), 0);
  if (uzun ? enK < 1100 || enK > 2000 : enK < 55 || enK > 125) e.push(`İngilizce toplam ${enK} kelime: uzun 1100-2000 (10-15 dk), Shorts 55-125 (30-50 sn)`);
  if (!uzun && !(H.ust?.en?.length && H.ust?.tr?.length)) e.push('Shorts: hikaye.ust {en:[satır1,satır2], tr:[...]} (üstteki soru kartı) yaz');
  if (uzun) {
    if (!H.kapak?.yazi?.en || !H.kapak?.yazi?.tr) e.push('uzun masal: hikaye.kapak { m, z, a, n, yazi:{en:[2 satır], tr:[2 satır]} } yaz');
    if (S.filter((s) => s.bolum).length < 3) e.push('uzun masal: en az 3 sahnede bolum {en, tr} (YouTube bölümleri)');
  }
  if (!/\?/.test(S[0]?.en ?? '') || !/\?/.test(S[0]?.tr ?? '')) e.push('ilk sahne iki dilde de soruyla başlamalı ("Why…? What do you think?")');
  if (!S[0]?.m) e.push('ilk sahnede m (mekân) yaz');
  S.forEach((s, i) => {
    const yer = `sahne ${i + 1}`;
    for (const d of ['en', 'tr']) if (!String(s[d] ?? '').trim()) e.push(`${yer}: ${d} metni boş`);
    if (CAGRI.test(`${s.en} ${s.tr}`)) e.push(`${yer}: çocuk kanalında abone/beğen/yorum çağrısı yasak`);
    if (s.m && !MEKAN.includes(s.m)) e.push(`${yer}: bilinmeyen mekân "${s.m}" (${MEKAN.join(', ')})`);
    if (s.z && !ZAMAN.includes(s.z)) e.push(`${yer}: bilinmeyen zaman "${s.z}"`);
    if (s.muzik && !MUZIK.includes(s.muzik)) e.push(`${yer}: müzik ${MUZIK.join(' / ')} olmalı`);
    for (const a of s.a ?? []) if (!AKTOR.includes(a.k)) e.push(`${yer}: bilinmeyen karakter "${a.k}"`);
    for (const x of s.n ?? []) if (!NESNE.includes(x.k)) e.push(`${yer}: bilinmeyen nesne "${x.k}"`);
    for (const x of s.e ?? []) if (!EFEKT.includes(x.k)) e.push(`${yer}: bilinmeyen efekt "${x.k}"`);
    if (kelimeSay(s.en) >= 8 && !anahtarlar(s).length && !(s.a ?? []).length) e.push(`${yer}: söylenen şey çizilmeli (karakter/nesne ve "en|tr" anahtar)`);
    for (const k of anahtarlar(s)) {
      const [en, tr] = k.split('|');
      if (!en || !tr) { e.push(`${yer}: anahtar "${k}" iki dilli olmalı ("jumped|zıpladı")`); continue; }
      if (!geciyor(s.en, en)) e.push(`${yer}: "${en}" İngilizce metinde yok`);
      if (!geciyor(s.tr, tr)) e.push(`${yer}: "${tr}" Türkçe metinde yok`);
    }
  });
  if (job.ikiz && !(job.ikiz.channelId && job.ikiz.title && job.ikiz.description)) e.push('ikiz { channelId, title, description, tags } (Türkçe kanal) eksik');
  return e.slice(0, 40);
}

// Dodi işinden DodiTr işi: aynı hikâye, Türkçe yayın bilgileri, varsayılan 24 saat sonra
export function masalIkizi(job, queueDir) {
  const k = job.ikiz;
  const gecikme = (k.gecikmeSaat ?? 24) * 3600_000;
  const publishAt = new Date(Math.max(Date.parse(job.publishAt) + gecikme, Date.now() + 3600_000)).toISOString();
  const id = `${publishAt.slice(0, 10)}_${k.channelId}_${job.type === 'long' ? 'long' : 'short'}-${job.hikaye.id ?? job.id.split('_').pop()}`;
  const ikiz = { id, channelId: k.channelId, type: job.type, format: 'masal', publishAt, topic: job.topic, title: k.title, description: k.description, tags: k.tags ?? job.tags, hikaye: job.hikaye, derivedFrom: job.id };
  fs.writeFileSync(path.join(queueDir, `${id}.json`), JSON.stringify(ikiz, null, 1));
  return id;
}
