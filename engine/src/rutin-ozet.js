// Gece rutini için kısa özet (token tasarrufu, 2026-11-25): hangi talimat dosyaları okunacak, hangi videolar yazılacak,
// yalnız ilgili kanalların bilgisi. Kapalı kanallar ve boş işler verilmez. Bağımlılık yok (plan.js'ten sonra çalışır).
//   node engine/src/rutin-ozet.js          → okunacaklar + işler + kanal bilgisi
//   node engine/src/rutin-ozet.js analiz   → etkin kanalların performans verisi (sıkıştırılmış)
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, ROOT } from './lib/paths.js';

const oku = (f, yoksa) => { try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, f), 'utf8')); } catch { return yoksa; } };
// boş alanları at, sayıları kısalt
export const sik = (o) => {
  if (Array.isArray(o)) return o.map(sik);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, sik(v)]).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
  return typeof o === 'number' && !Number.isInteger(o) ? Math.round(o * 100) / 100 : o;
};
export function okunacaklar({ needed, kanallar, perf, kesif, istek, yorum }) {
  const f = new Set(['routine/PROMPT.md']);
  const b = (ad) => f.add(`routine/bolumler/${ad}.md`);
  for (const j of needed) {
    if (j.masterV4) f.add('routine/MASTER-v4.md');
    if (j.hizli) b('hizli-shorts');
    if (j.seri) b('seri');
    if (j.oylama) b('oylama');
    if (j.clipOf && j.format !== 'dizi') b('kesit');
    if (j.format === 'dizi') b('dizi');
    else if (j.format === 'cizim') b('cizim');
    else if (j.format === 'masal') b('masal');
    else if (j.format === 'duell') b('flaggenduell');
    else b('gorsel');
  }
  const etkin = new Set(kanallar.filter((c) => c.enabled).map((c) => c.id));
  if (Object.keys(perf ?? {}).some((id) => etkin.has(id))) b('analiz');
  if (Object.entries(perf ?? {}).some(([id, p]) => etkin.has(id) && p?.raporGerekli)) b('haftalik');
  const rd = path.join(CONFIG_DIR, 'rakipler');
  if (fs.existsSync(rd) && fs.readdirSync(rd).some((x) => x.endsWith('.json') && etkin.has(x.slice(0, -5)))) b('rakip');
  if (Array.isArray(yorum) ? yorum.length : Object.keys(yorum ?? {}).length) b('yorum');
  const doluMu = (o) => Boolean(o && (Array.isArray(o) ? o.length : Object.values(o).some((v) => Array.isArray(v) && v.length)));
  if (doluMu(kesif) || doluMu(istek)) b("kesif");
  if (doluMu(istek)) b("dizi"); // pilot dizi formatında yazılır
  return [...f];
}

function main() {
  const kanallar = oku('channels.json', []);
  const perf = oku('performans.json', {});
  const needed = oku('needed.json', []);
  const etkin = new Set(kanallar.filter((c) => c.enabled).map((c) => c.id));
  if (process.argv[2] === 'analiz') {
    for (const [id, p] of Object.entries(perf)) if (etkin.has(id)) console.log(id, JSON.stringify(sik({ ...p, videolar: p.videolar?.slice?.(0, 12) })));
    return;
  }
  console.log('## Okunacak talimatlar (yalnız bunlar)');
  for (const f of okunacaklar({ needed, kanallar, perf, kesif: oku('kesif.json', {}), istek: oku('kesif-istekler.json', []), yorum: oku('yorumlar.json', []) })) console.log('-', f);
  console.log('\n## Yazılacak videolar');
  for (const j of needed) console.log(JSON.stringify(sik(j)));
  console.log('\n## İlgili kanallar');
  const ids = new Set(needed.map((j) => j.channelId));
  for (const c of kanallar.filter((x) => ids.has(x.id))) {
    const { settings, recentTitles, ...gerisi } = c;
    console.log(JSON.stringify(sik({ ...gerisi, format: settings?.contentFormat, dizi: settings?.dizi, ekTalimat: gerisi.brief?.extraInstructions || JSON.stringify(gerisi.brief ?? '').includes((settings?.extraInstructions ?? '').slice(0, 60) || '\u0000') ? null : settings?.extraInstructions, sonBasliklar: (recentTitles ?? []).slice(0, 40) })));
  }
}
if (process.argv[1] && path.basename(process.argv[1]) === 'rutin-ozet.js') main();
