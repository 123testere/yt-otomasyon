// Kanal karakterinin yüzü bir kez çizilir, Firestore'da saklanır ve her videoda aynısı kullanılır.
// Karakter seçimi değişirse ya da uygulamadan "Yeni yüz çiz" istenirse yeniden çizilir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from './firebase.js';
import { characterOf, options, pick } from './options.js';
import { hashSeed } from './util.js';
import { aiImage } from '../pipeline/visuals.js';

const PORTRAIT_STYLE = 'head and shoulders portrait, centered, looking at camera, soft studio lighting, detailed digital illustration';

const keyOf = (character) => `${character.id}|${character.prompt}`;

export async function ensurePortrait(channelId, settings, outDir = os.tmpdir()) {
  const character = characterOf(settings);
  if (!character) return null;
  // Ansiklopedi stilinde karakter (Nur Bey) Remotion'da kodla çizilir; yapay zekâ portresi gerekmez.
  if (pick(options.visualStyles, settings.visualStyle)?.theme) return null;

  const ref = db().doc(`characters/${channelId}`);
  const saved = (await ref.get()).data();
  const file = path.join(outDir, `karakter-${channelId}.jpg`);

  if (saved?.image && saved.key === keyOf(character) && !saved.regenerate) {
    fs.writeFileSync(file, Buffer.from(saved.image, 'base64'));
    return file;
  }

  // İlk çizimde kanal + karakterden türeyen sabit tohum; "yeni yüz" isteğinde farklı tohum.
  const seed = saved?.regenerate ? Math.floor(Math.random() * 1_000_000) : hashSeed(`${channelId}:${keyOf(character)}`);
  await aiImage(`${character.prompt}, ${PORTRAIT_STYLE}`, { w: 768, h: 768, seed }, file);
  await ref.set({
    key: keyOf(character),
    label: character.label,
    seed,
    image: fs.readFileSync(file).toString('base64'),
    regenerate: false,
    createdAt: new Date(),
  });
  console.log(`  "${character.label}" karakterinin yüzü çizildi (${channelId}).`);
  return file;
}
