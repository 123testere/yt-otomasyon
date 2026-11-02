// Flaggenduell konu kataloğu ve Claude'un senaryo yazarken bakacağı hazır sıralamalar.
// Sıralamalar GitHub Actions'ta (senkron sırasında) hesaplanır ve config/duell-standings.json'a yazılır;
// böylece bulut rutini sayı uydurmadan, verinin kendisine bakarak yazar.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, ROOT } from '../lib/paths.js';
import { stableJson } from '../lib/util.js';
import { COUNTRY_SETS, faoStandings } from './match.js';

export const DUELL_TOPICS = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'duell-topics.json'), 'utf8'));
export const topicById = (id) => DUELL_TOPICS.find((t) => t.id === id);
const STANDINGS_FILE = path.join(CONFIG_DIR, 'duell-standings.json');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // FAO verisi yılda bir güncellenir; haftalık tazelemek yeter

export async function standingsFor(topic) {
  if (topic.source !== 'fao') throw new Error(`Bilinmeyen veri kaynağı: ${topic.source}`);
  return faoStandings(topic.itemCode, COUNTRY_SETS.europe);
}

// Katalogdaki her konu için ilk 6, veri sayısı ve yıl. Değişmediyse dosyaya dokunmaz.
export async function refreshStandings({ force = false } = {}) {
  if (!force && fs.existsSync(STANDINGS_FILE)) {
    const current = JSON.parse(fs.readFileSync(STANDINGS_FILE, 'utf8'));
    const sameTopics = Object.keys(current.topics ?? {}).sort().join() === DUELL_TOPICS.map((t) => t.id).sort().join();
    if (sameTopics && Date.now() - Date.parse(current.generatedAt) < MAX_AGE_MS) return false;
  }
  const topics = {};
  for (const t of DUELL_TOPICS) {
    const s = await standingsFor(t);
    topics[t.id] = {
      question: t.question, label: t.label, year: s.year, source: s.source,
      countries: COUNTRY_SETS.europe.length, withData: s.ranked.length, noData: s.noData.length,
      top: s.ranked.slice(0, 6).map((c) => ({ name: c.name, tonnes: Math.round(c.value) })),
    };
  }
  fs.writeFileSync(STANDINGS_FILE, stableJson({ generatedAt: new Date().toISOString(), topics }));
  return true;
}
