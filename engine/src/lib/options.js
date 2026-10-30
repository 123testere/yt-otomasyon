import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

export const options = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'options.json'), 'utf8'));

export function pick(list, id) {
  return list.find((item) => String(item.id) === String(id));
}

// Uygulamadan gelen eksik/eski ayarları varsayılanlarla tamamlar.
export function resolveSettings(settings = {}) {
  const d = options.defaults;
  const s = {
    ...d,
    ...settings,
    long: { ...d.long, ...(settings.long ?? {}) },
    shorts: { ...d.shorts, ...(settings.shorts ?? {}) },
  };
  const language = pick(options.languages, s.language) ?? options.languages[0];
  s.language = language.id;
  if (!language.voices.some((v) => v.id === s.voice)) s.voice = language.voices[0].id;
  return s;
}

export function languageOf(settings) {
  return pick(options.languages, settings.language);
}

export function nicheOf(settings) {
  return pick(options.niches, settings.niche) ?? pick(options.niches, 'ozel');
}

export function characterOf(settings) {
  const c = pick(options.characters, settings.character);
  if (!c || c.id === 'yok') return null;
  if (c.custom) {
    if (!settings.customCharacter?.trim()) return null;
    return { id: 'ozel', label: 'Özel', persona: settings.customCharacter, prompt: settings.customCharacter };
  }
  return c;
}

// "Ses ifadesi" seçimi; eski kanallarda yoksa "dengeli".
export function voiceStyleOf(settings) {
  return pick(options.voiceStyles ?? [], settings.voiceStyle) ?? pick(options.voiceStyles ?? [], 'dengeli') ?? {};
}

export function targetWords(settings, type) {
  const wpm = languageOf(settings).wpm;
  return type === 'short'
    ? Math.round((settings.shorts.seconds / 60) * wpm)
    : Math.round(settings.long.minutes * wpm);
}
