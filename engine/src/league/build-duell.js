// Flaggenduell senaryosunu videoya çevirir: veriyi tazeler, sezon tablosunu günceller, huniyi render eder.
// Sezon durumu Firestore'da leagues/<kanal> belgesinde tutulur; yükleme başarılı olunca kaydedilir.
// Maç numarası yayın gününden hesaplanır (lib/league.js), böylece rutin ve motor aynı numarayı kullanır.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../lib/firebase.js';
import { matchFor, POINTS } from '../lib/league.js';
import { options } from '../lib/options.js';
import { dateInTz } from '../lib/time.js';
import { pickMusic } from '../pipeline/render.js';
import { COUNTRY_SETS, renderMatch } from './match.js';
import { standingsFor, topicById } from './catalog.js';

export async function buildDuell(job, settings, { workDir }) {
  const topic = topicById(job.duell.topicId);
  if (!topic) throw new Error(`Bilinmeyen Flaggenduell konusu: ${job.duell.topicId}`);
  const dir = path.join(workDir, job.id);
  fs.mkdirSync(dir, { recursive: true });

  const standings = await standingsFor(topic);
  const ref = db().doc(`leagues/${job.channelId}`);
  const state = (await ref.get()).data() ?? {};
  const calendarStart = state.calendarStart ?? dateInTz(new Date(job.publishAt), options.timezone);
  const m = matchFor(dateInTz(new Date(job.publishAt), options.timezone), calendarStart)
    ?? { season: 1, match: 1, total: 30, final: false, eveOfFinal: false };

  // Yeni sezona geçildiyse puanlar sıfırdan başlar.
  const points = state.season === m.season ? { ...(state.points ?? {}) } : {};
  standings.ranked.slice(0, POINTS.length).forEach((c, i) => { points[c.iso2] = (points[c.iso2] ?? 0) + POINTS[i]; });
  const names = Object.fromEntries(COUNTRY_SETS.europe.map((c) => [c.iso2, c.name]));
  const table = Object.entries(points).sort((a, b) => b[1] - a[1]).slice(0, POINTS.length)
    .map(([iso2, p]) => ({ iso2, name: names[iso2], points: p }));

  // Final ve final öncesi duyuruları motor ekler; şampiyonun adı ve puanı gerçek tablodan gelir.
  const script = { ...job.duell.script };
  if (m.final) {
    script.table = `Das war Saison ${m.season}! Und der Saisonsieger ist ${table[0].name} mit ${table[0].points} Punkten! `
      + `Morgen startet Saison ${m.season + 1} – schreib dein Wunschduell in die Kommentare!`;
  } else if (m.eveOfFinal && !/finale/i.test(script.table)) {
    script.table = `${script.table} Morgen steigt das große Saisonfinale!`;
  }

  const music = await pickMusic(settings.music, dir);
  console.log(`  Flaggenduell: ${topic.label} · Saison ${m.season}, Duell ${m.match}/${m.total}${m.final ? ' (FINALE)' : ''} · Sieger ${standings.ranked[0]?.name}`);
  const r = await renderMatch({
    id: job.id, format: 'duell', countries: COUNTRY_SETS.europe, brand: 'FLAGGENDUELL',
    standings, script, settings, music: music?.file, out: path.join(dir, 'video.mp4'),
    season: m.season, match: m.match, table,
    topic: { question: topic.question, emoji: topic.emoji, unit: 't', why: job.duell.why },
    extra: { total: m.total, seasonFinal: m.final, eveOfFinal: m.eveOfFinal },
  });

  const today = new Date().toISOString().slice(0, 10);
  const dataNote = `Daten: ${standings.source}, ${topic.label}, Produktion ${standings.year} (Tonnen), abgerufen am ${today}. `
    + `Teilnehmer: die ${COUNTRY_SETS.europe.length} Mitgliedstaaten des Europarats; Länder ohne Daten scheiden in Runde 1 aus. `
    + `Punkte pro Duell: ${POINTS.join('-')} für die Plätze 1 bis ${POINTS.length}.`;
  return {
    videoPath: r.out, thumbnailPath: null, duration: r.duration,
    credits: [dataNote, music?.credit].filter(Boolean),
    leagueUpdate: {
      calendarStart, season: m.season, lastMatch: m.match, points, lastTopic: topic.id,
      ...(m.final ? { champions: { ...(state.champions ?? {}), [m.season]: table[0] } } : {}),
      updatedAt: new Date(),
    },
  };
}
