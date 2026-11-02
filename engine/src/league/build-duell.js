// Flaggenduell senaryosunu videoya çevirir: veriyi tazeler, sezon tablosunu günceller, huniyi render eder.
// Sezon durumu Firestore'da leagues/<kanal> belgesinde tutulur; yükleme başarılı olunca kaydedilir.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../lib/firebase.js';
import { pickMusic } from '../pipeline/render.js';
import { COUNTRY_SETS, renderMatch } from './match.js';
import { standingsFor, topicById } from './catalog.js';

const POINTS = [10, 7, 5, 4, 3, 2, 1];
const MATCHES_PER_SEASON = 30;

export async function buildDuell(job, settings, { workDir }) {
  const topic = topicById(job.duell.topicId);
  if (!topic) throw new Error(`Bilinmeyen Flaggenduell konusu: ${job.duell.topicId}`);
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });

  const standings = await standingsFor(topic);
  const state = (await db().doc(`leagues/${job.channelId}`).get()).data() ?? { season: 1, match: 0, points: {} };
  let { season, match, points } = state;
  if (match >= MATCHES_PER_SEASON) {
    season += 1;
    match = 0;
    points = {};
  }
  match += 1;
  const newPoints = { ...points };
  standings.ranked.slice(0, POINTS.length).forEach((c, i) => { newPoints[c.iso2] = (newPoints[c.iso2] ?? 0) + POINTS[i]; });
  const names = Object.fromEntries(COUNTRY_SETS.europe.map((c) => [c.iso2, c.name]));
  const table = Object.entries(newPoints).sort((a, b) => b[1] - a[1]).slice(0, POINTS.length)
    .map(([iso2, p]) => ({ iso2, name: names[iso2], points: p }));

  const music = await pickMusic(settings.music, dir);
  console.log(`  Flaggenduell: ${topic.label} · Saison ${season}, Duell ${match} · Sieger ${standings.ranked[0]?.name}`);
  const r = await renderMatch({
    id: job.id, format: 'duell', countries: COUNTRY_SETS.europe, brand: 'FLAGGENDUELL',
    standings, script: job.duell.script, settings, music: music?.file, out: path.join(dir, 'video.mp4'),
    season, match, table,
    topic: { question: topic.question, emoji: topic.emoji, unit: 't', why: job.duell.why },
  });

  const today = new Date().toISOString().slice(0, 10);
  const dataNote = `Daten: ${standings.source}, ${topic.label}, Produktion ${standings.year} (Tonnen), abgerufen am ${today}. `
    + `Teilnehmer: die ${COUNTRY_SETS.europe.length} Mitgliedstaaten des Europarats; Länder ohne Daten scheiden in Runde 1 aus.`;
  return {
    videoPath: r.out, thumbnailPath: null, duration: r.duration,
    credits: [dataNote, music?.credit].filter(Boolean),
    leagueUpdate: { season, match, points: newPoints, lastTopic: topic.id, updatedAt: new Date() },
  };
}
