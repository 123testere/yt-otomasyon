// Klip kampanyası kuralları (config/kampanyalar.json). Bağımlılıksız: doğrulayıcı da kullanır.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

export function kampanyalar() {
  const f = path.join(ROOT, 'config', 'kampanyalar.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).kampanyalar ?? [] : [];
}
export const kampanyaBul = (id) => kampanyalar().find((k) => k.id === id) ?? null;

// Yayıncıyı olumsuz gösterebilecek başlıklar (kampanyalar reddeder): klip başlığı izleyici yazısıdır, süzülür.
const OLUMSUZ = /\b(cring(e|y)|fail(s|ed)?|exposed|cancel+ed|racis[mt]|hate[sd]?|caught|cheat(s|ing|ed)?|toxic|disgust|nsfw|drunk|banned?|l+ ?streamer|ratio|fraud|scam|clown(ed)?|embarrass\w*|meltdown|beef|crash ?outs?|rage ?quits?|tilted|mad|angry|cries|crying|sad)\b/i;
// Cinsel/uygunsuz başlıklar ve "an" olmayan yayın başlıkları (🚨 GIVEAWAY 24/7 …) de elenir
const UYGUNSUZ = /\b(naked|gya+t+|ban|kill\w*\b.{0,25}\b(dog|cat|animal|pet)\w*|peg+ing|sex\w*|horny|nud(e|es|ity)|porn\w*|thirst\w*|onlyfans|strip(per|ping)?|booty|twerk\w*|kys|slur)\b/i;
const YAYIN_BASLIGI = /(🚨.*🚨)|\b(giveaways?|24\/7|early access|!drop|!sub|sub(athon)?\b.*\bday\s*\d)/i;
export const olumsuzMu = (metin) => OLUMSUZ.test(String(metin ?? '')) || UYGUNSUZ.test(String(metin ?? ''));
export const yayinBasligiMi = (metin) => YAYIN_BASLIGI.test(String(metin ?? ''));

export function kampanyaHatalari(job, k) {
  if (!k) return [`kampanya bulunamadı: ${job.kampanya}`];
  const e = [];
  const ad = k.zorunluAd.toLowerCase();
  const ekran = [job.hook, job.kredi].join(' ').toLowerCase();
  if (!job.title.toLowerCase().includes(ad) && !ekran.includes(ad)) e.push(`başlıkta ya da ekran yazısında "${k.zorunluAd}" geçmeli`);
  if (!job.description.toLowerCase().includes(ad)) e.push(`açıklamada "${k.zorunluAd}" geçmeli`);
  for (const t of k.etiketler.slice(0, 1)) if (!job.description.includes(t)) e.push(`açıklamada ${t} etiketi olmalı`);
  if (k.yapayZekaYasak && ((job.yorum ?? []).length || job.kapanis?.metin)) e.push('bu kampanyada bilgisayar sesiyle yorum yasak (yorum/kapanis.metin olmamalı)');
  if (olumsuzMu(job.title) || olumsuzMu(job.hook)) e.push('başlık/kanca yayıncıyı olumsuz gösteriyor olabilir');
  return e;
}
