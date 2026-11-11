// node --test test/  — optimizasyon mantığı (ağ ve Firestore olmadan).
import test from 'node:test';
import assert from 'node:assert/strict';
import { degerlendir, deneyHatalari, deneyAyari, kazananAyari, sonrakiDeney, uygunMu, deneyBul, altSaat } from '../src/lib/deney.js';
import { teshis, enBuyukDusus, haftalikOzet } from '../src/lib/analysis.js';
import { reachCsv, reachUygula, aralikCtr } from '../src/lib/reach.js';
import { dersEkle, aktifDersler, kapakAdayi, haftaOf } from '../src/lib/optimize.js';
import { resolveSettings } from '../src/lib/options.js';
import { egriOzet, saniye } from '../src/lib/perf.js';

const lamba = resolveSettings({ music: 'huzurlu', musicVolume: '0.2', shorts: { times: ['19:00'], seconds: 45 }, long: { days: [1] } });
const duell = resolveSettings({ contentFormat: 'flaggenduell', music: 'yok', shorts: { times: ['08:00'] }, long: { days: [] } });

test('sıradaki deney: uygun olanlar sırayla, duell içerik deneyine girmez', () => {
  assert.equal(sonrakiDeney(lamba, []).id, 'kanca-soru');
  assert.equal(sonrakiDeney(lamba, [{ id: 'kanca-soru' }]).id, 'baslik-kalip');
  const hepsi = ['kanca-soru', 'baslik-kalip', 'sure-kisa', 'muzik-seviye', 'yayin-saati'].map((id) => ({ id }));
  assert.equal(sonrakiDeney(lamba, hepsi).id, 'kanca-soru'); // hepsi denendiyse en eskisi
  assert.equal(sonrakiDeney(duell, []).id, 'yayin-saati'); // müzik yok, içerik deneyleri hariç
  assert.equal(uygunMu(deneyBul('kapak-yazi'), lamba, 'short'), false);
  assert.equal(uygunMu(deneyBul('yayin-saati'), resolveSettings({ shorts: { times: ['12:00', '19:00'] } }), 'short'), false);
});

test('deney kontrolleri senaryoyu denetler', () => {
  const slot = { id: 'kanca-soru', kol: 'A' };
  const job = { title: 'X', scenes: [{ narration: 'Hiç düşündün mü bu bardak neden ince? Devamı.' }], deney: { id: 'kanca-soru', kol: 'A' } };
  assert.deepEqual(deneyHatalari(job, slot), []);
  assert.equal(deneyHatalari({ ...job, deney: undefined }, slot).length, 1);
  assert.equal(deneyHatalari({ ...job, deney: { id: 'kanca-soru', kol: 'B' } }, { id: 'kanca-soru', kol: 'B' }).length, 1);
  const baslik = { id: 'baslik-kalip', kol: 'B' };
  assert.deepEqual(deneyHatalari({ title: 'Simit 1525 yılında doğdu 🥯', deney: baslik }, baslik), []);
  assert.equal(deneyHatalari({ title: 'Simit neden yuvarlak?', deney: baslik }, baslik).length, 1);
  const soru = { id: 'baslik-kalip', kol: 'A' };
  assert.deepEqual(deneyHatalari({ title: 'Simit neden yuvarlak? 🥯', deney: soru }, soru), []);
  assert.deepEqual(deneyHatalari({ title: 'X', deney: { id: 'sure-kisa', kol: 'B' } }, { id: 'sure-kisa', kol: 'B' }), []);
});

test('motor deneyleri: müzik B kolu bir kademe kısık, kazanınca ayar değişir', () => {
  assert.equal(deneyAyari({ deney: { id: 'muzik-seviye', kol: 'B' } }, lamba).musicVolume, '0.12');
  assert.equal(deneyAyari({ deney: { id: 'muzik-seviye', kol: 'A' } }, lamba).musicVolume, '0.2');
  assert.deepEqual(kazananAyari('muzik-seviye', lamba), { 'settings.musicVolume': '0.12' });
  assert.deepEqual(kazananAyari('sure-kisa', lamba), { 'settings.shorts.seconds': 35 });
  assert.deepEqual(kazananAyari('yayin-saati', lamba), { 'settings.shorts.times': ['12:00'] });
  assert.equal(altSaat('08:00'), '19:00');
});

test('değerlendirme: yeterli veri yoksa bekler, fark %10 üstündeyse kazanan', () => {
  const kayit = { id: 'kanca-soru', tip: 'short', baslangic: '2026-11-01T00:00:00Z' };
  const p = (kol, kancaOran, sabit = true) => ({ kol, kancaOran, tip: 'short', sabit });
  const now = new Date('2026-11-10T00:00:00Z');
  assert.equal(degerlendir(kayit, [p('A', 0.4), p('B', 0.5)], now), null);
  const r = degerlendir(kayit, [p('A', 0.40), p('A', 0.42), p('A', 0.38), p('B', 0.50), p('B', 0.55), p('B', 0.48)], now);
  assert.equal(r.kazanan, 'B');
  assert.ok(r.fark > 0.2);
  const esit = degerlendir(kayit, [p('A', 0.40), p('A', 0.42), p('A', 0.41), p('B', 0.42), p('B', 0.41), p('B', 0.43)], now);
  assert.equal(esit.kazanan, 'belirsiz');
  // 21 gün dolunca az veriyle de kapanır
  const gec = degerlendir(kayit, [p('A', 0.4)], new Date('2026-11-25T00:00:00Z'));
  assert.equal(gec.kazanan, 'belirsiz');
  // tıklanma gelmiyorsa izlenmeye düşer
  const b = { id: 'baslik-kalip', tip: 'short', baslangic: '2026-11-01T00:00:00Z' };
  const q = (kol, izlenme7) => ({ kol, izlenme7, tiklanma7: null, sabit: true });
  const r2 = degerlendir(b, [q('A', 100), q('A', 120), q('A', 110), q('B', 200), q('B', 210), q('B', 190)], now);
  assert.equal(r2.olcu, 'izlenme7');
  assert.equal(r2.kazanan, 'B');
});

test('teşhis: zayıf kanca ve kopuş noktası', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  const peer = (i) => ({ youtubeId: `p${i}`, tip: 'short', izlenme7: 1000 + i * 10, kancaOran: 0.5, tutma: 70, abone7: 1, yayin: '2026-11-01T00:00:00Z' });
  const peers = [1, 2, 3, 4, 5].map(peer);
  const egri = Array.from({ length: 20 }, (_, i) => (i < 10 ? 0.9 : 0.4));
  const v = { youtubeId: 'v', tip: 'short', izlenme7: 400, kancaOran: 0.3, tutma: 40, egri, sure: 40, abone7: 0, yayin: '2026-11-05T00:00:00Z' };
  const job = { scenes: [{ narration: 'Birinci sahne.' }, { narration: 'Kopuşun olduğu sahne burada.' }] };
  const t = teshis(v, [...peers, v], { job, sahneZaman: [0, 15], now });
  assert.equal(t.etiket, 'zayif');
  assert.ok(t.nedenler.some((n) => n.tur === 'kanca' && !n.iyi));
  const tutma = t.nedenler.find((n) => n.tur === 'tutma');
  assert.match(tutma.metin, /0:21 civarında: “Kopuşun olduğu sahne burada\.”/);
  assert.equal(enBuyukDusus(egri, 40).saniye, 21);
  // az izlenen video hüküm almaz
  assert.equal(teshis({ ...v, izlenme7: 20 }, peers, { now }).etiket, 'az-veri');
  const raporAni = new Date('2026-11-12T00:00:00Z');
  const rapor = haftalikOzet([...peers, v].map((p) => ({ ...p, baslik: p.youtubeId, teshis: teshis(p, [...peers, v], { now: raporAni }) })), raporAni);
  assert.match(rapor.satirlar[0], /değerlendirildi/);
});

test('erişim raporu CSV: gösterim ve tıklanma oranı', () => {
  const csv = 'date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr\n'
    + '20261102,UC1,v1,1000,0.05\n20261102,UC1,v1,500,0.02\n20261103,UC1,v1,800,0.04\n20261103,UC1,v2,0,0\n';
  const r = reachCsv(csv);
  assert.deepEqual(r.v1['20261102'], [1500, 60]);
  assert.equal(r.v2, undefined);
  const p = reachUygula({ yayin: '2026-11-02T10:00:00Z' }, r.v1, new Date('2026-11-10T00:00:00Z'));
  assert.equal(p.gosterim7, 2300);
  assert.equal(p.tiklanma7, Math.round((92 / 2300) * 10000) / 100);
  assert.deepEqual(aralikCtr(p.gunluk, '20261103', '20261110'), { gosterim: 800, ctr: 4 });
});

test('dersler: tekrar eklenmez, silinenler senaryo yazarına gitmez, en fazla 12', () => {
  let d = dersEkle([], [{ id: 'a', metin: 'Kancayı soruyla aç.', kaynak: 'deney' }]);
  d = dersEkle(d, [{ id: 'b', metin: 'kancayı soruyla aç', kaynak: 'analiz' }]);
  assert.equal(d.length, 1);
  for (let i = 0; i < 15; i++) d = dersEkle(d, [{ id: `x${i}`, metin: `Ders ${i}`, kaynak: 'analiz' }]);
  assert.equal(d.length, 12);
  assert.ok(d.some((x) => x.id === 'a')); // deney dersi korunur
  assert.deepEqual(aktifDersler({ optimizasyon: { dersler: d.slice(0, 2) }, settings: { optimizasyon: { silinenDersler: ['a'] } } }), [d[1].metin]);
});

test('zayıf kapak adayı', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  const long = (id, ctr) => ({ youtubeId: id, tip: 'long', tiklanma7: ctr, gosterim7: 2000, yayin: '2026-11-10T00:00:00Z' });
  const perfs = [long('a', 6), long('b', 5), long('c', 7), long('d', 2)];
  const job = { thumbnailTextAlt: 'YEDEK YAZI' };
  assert.equal(kapakAdayi(perfs[3], perfs, job, lamba, now), true);
  assert.equal(kapakAdayi(perfs[0], perfs, job, lamba, now), false);
  assert.equal(kapakAdayi(perfs[3], perfs, {}, lamba, now), false);
  assert.equal(kapakAdayi({ ...perfs[3], kapakDeneme: { durum: 'kazandi' } }, perfs, job, lamba, now), false);
});

test('yardımcılar', () => {
  assert.equal(saniye('PT1M5S'), 65);
  assert.equal(saniye('PT2H'), 7200);
  assert.equal(egriOzet([[0.05, 1], [0.5, 0.5], [1, 0.2]]).length, 20);
  assert.equal(haftaOf(new Date('2026-11-09T06:00:00Z')), '2026-W46');
});

test('planlayıcı: deney kolları sırayla A/B, süre ve saat deneyinde B kolu değişir', async () => {
  const { neededJobs } = await import('../src/lib/plan.js');
  const now = new Date('2026-11-05T05:00:00Z'); // İstanbul 08:00
  const kanal = (deney, settings = {}) => ({
    id: 'TEST_DENEY', enabled: true, deney,
    settings: resolveSettings({ ...settings, shorts: { times: ['19:00'], seconds: 40 }, long: { days: [] } }),
  });
  const sure = neededJobs([kanal({ id: 'sure-kisa', tip: 'short' })], { now });
  assert.deepEqual(sure.map((j) => j.deney.kol), ['A', 'B']);
  assert.equal(sure[1].targetWords, Math.round(sure[0].targetWords * 0.75));
  const saat = neededJobs([kanal({ id: 'yayin-saati', tip: 'short' })], { now });
  assert.equal(saat[1].deney.kol, 'B');
  assert.equal(saat[1].publishAt, '2026-11-06T09:00:00.000Z'); // 12:00 İstanbul
  const kapali = neededJobs([kanal({ id: 'kanca-soru', tip: 'short' }, { optimizasyon: { deneyler: false } })], { now });
  assert.equal(kapali[0].deney, undefined);
  const talimat = neededJobs([kanal({ id: 'kanca-soru', tip: 'short' })], { now });
  assert.match(talimat[0].deney.talimat, /soru/);
  assert.deepEqual(talimat[0].ceviriDilleri, ['en']);
});

test('bölüm zaman damgaları ve altyazı', async () => {
  const { bolumSatirlari, srtOf } = await import('../src/pipeline/extras.js');
  const job = { type: 'long', scenes: [
    { narration: 'Giriş cümlesi.' }, { narration: 'İkinci.', bolum: { no: 'Bölüm I', ad: 'Konuşamayan tel' } },
    { narration: 'Üç.' }, { narration: 'Dört.', bolum: { no: 'Bölüm II', ad: 'İstanbul' } }, { narration: 'Beş.', bolum: { ad: 'Yakın' } },
  ] };
  assert.equal(bolumSatirlari(job, [0, 25, 50, 75, 80], 'tr'), '00:00 Giriş\n00:25 Bölüm I: Konuşamayan tel\n01:15 Bölüm II: İstanbul');
  assert.equal(bolumSatirlari(job, [0, 25, 50, 3700, 3800], 'tr').split('\n').at(-1), '1:03:20 Yakın');
  assert.equal(bolumSatirlari({ ...job, type: 'short' }, [0, 1, 2, 3, 4], 'tr'), null);
  const narrated = { scenes: [{ words: [{ t: 0, d: 0.4, w: 'Merhaba' }, { t: 0.5, d: 0.5, w: 'dünya' }, { t: 1.2, d: 0.4, w: 'nasılsın' }] }] };
  const srt = srtOf({ scenes: [{ narration: 'Merhaba dünya. Nasılsın?' }] }, narrated);
  assert.equal(srt, '1\n00:00:00,000 --> 00:00:01,000\nMerhaba dünya.\n\n2\n00:00:01,200 --> 00:00:01,700\nNasılsın?\n');
});

// --- Kimlik sözleşmesi ve sahne analizi ---
import { kimlikDersiMi } from '../src/lib/optimize.js';
import { sahneAnalizi } from '../src/lib/sahne-analizi.js';

test('kimlikle ilgili dersler reddedilir, içerik dersleri kabul edilir', () => {
  assert.equal(kimlikDersiMi('Nur Bey daha esprili konuşsun'), true);
  assert.equal(kimlikDersiMi('Anlatıcının sesi değişsin'), true);
  assert.equal(kimlikDersiMi('Kancayı rakamla aç, ilk cümle 10 kelimeyi geçmesin'), false);
});

test('sahne analizi: uzun anlatımlı sahneler daha çok izleyici kaybettiriyor', () => {
  const sahne = (k) => ({ mekan: 'ofis', satirlar: [{ kim: 'anlatici', metin: Array(k).fill('kelime').join(' ') }] });
  const jobs = {}; const zaman = {}; const perfs = [];
  for (let v = 0; v < 4; v++) {
    const id = `j${v}`;
    jobs[id] = { format: 'dizi', scenes: [sahne(5), sahne(30), sahne(5), sahne(30), sahne(5)] };
    zaman[id] = [0, 10, 20, 30, 40];
    // 50 sn video: uzun sahnelerde (10-20, 30-40) hızlı düşüş
    const egri = Array.from({ length: 20 }, (_, i) => { const t = ((i + 1) / 20) * 50; let r = 1; for (let s = 0; s < t; s++) r -= (s >= 10 && s < 20) || (s >= 30 && s < 40) ? 0.03 : 0.005; return r; });
    perfs.push({ youtubeId: `y${v}`, jobId: id, tip: 'short', sure: 50, egri });
  }
  const r = sahneAnalizi(perfs, jobs, zaman);
  assert.equal(r.yeterli, true);
  assert.equal(r.enCokKaybettiren[0].ozellik, 'uzun anlatım (25+ kelime)');
});
