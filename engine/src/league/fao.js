// FAOSTAT tarım üretimi verisi. API anahtar istediği için FAO'nun ücretsiz toplu veri dosyası kullanılır;
// bir kez indirilir, önbellekte tutulur ve satır satır taranır (dosya açılınca ~1 GB).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { download, run } from '../lib/util.js';

const URL = 'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip';
const CSV_NAME = 'Production_Crops_Livestock_E_All_Data_(Normalized).csv';
const CACHE = process.env.FAO_CACHE ?? path.join(os.homedir(), '.cache', 'faostat');
export const FAO_SOURCE = 'FAOSTAT – Crops and livestock products (FAO)';

async function ensureCsv() {
  const csv = path.join(CACHE, CSV_NAME);
  if (fs.existsSync(csv)) return csv;
  fs.mkdirSync(CACHE, { recursive: true });
  const zip = path.join(CACHE, 'fao.zip');
  if (!fs.existsSync(zip)) {
    console.log('  FAOSTAT verisi indiriliyor (~34 MB)…');
    await download(URL, zip, { timeoutMs: 600_000 });
  }
  // Windows'ta tar zip açabilir; Linux'ta unzip kullanılır.
  if (process.platform === 'win32') {
    await run(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', CACHE, CSV_NAME]);
  }
  else await run('unzip', ['-o', '-q', zip, CSV_NAME, '-d', CACHE]);
  return csv;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// Bir ürünün (FAO ürün kodu) en güncel yıldaki üretimini ülke M49 koduna göre döndürür.
export async function faoProduction(itemCode, { element = 5510 } = {}) {
  const csv = await ensureCsv();
  const rl = readline.createInterface({ input: fs.createReadStream(csv, 'latin1'), crlfDelay: Infinity });
  let header = null;
  const byYear = new Map(); // yıl → Map(m49 → değer)
  let itemName = null;
  for await (const line of rl) {
    if (!header) {
      header = Object.fromEntries(parseCsvLine(line).map((h, i) => [h, i]));
      continue;
    }
    // Hızlı ön eleme: satırda ürün kodu geçmiyorsa ayrıştırma.
    if (!line.includes(`,${itemCode},`) && !line.includes(`,"${itemCode}",`)) continue;
    const c = parseCsvLine(line);
    if (Number(c[header['Item Code']]) !== itemCode || Number(c[header['Element Code']]) !== element) continue;
    const value = c[header.Value];
    if (value === '') continue;
    const m49 = Number(String(c[header['Area Code (M49)']]).replace(/\D/g, ''));
    const year = Number(c[header.Year]);
    itemName ??= c[header.Item];
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year).set(m49, Number(value));
  }
  if (!byYear.size) throw new Error(`FAOSTAT'ta ${itemCode} kodlu ürün bulunamadı`);
  // En güncel ve yeterince dolu yıl (son yıllar bazen eksik yayımlanır).
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const year = years.find((y) => byYear.get(y).size >= byYear.get(years[0]).size * 0.8) ?? years[0];
  return { item: itemName, year, unit: 't', values: byYear.get(year), source: FAO_SOURCE };
}
