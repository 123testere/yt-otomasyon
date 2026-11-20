// node --test test/  — yayın kesiti tespiti (stream-clipper uyarlaması), ağsız.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sesSicramalari, sohbetSicramalari, haritaSicramalari, zamanDamgalari, yorumSicramalari, puanla, kesitAraligi, enIyiKesitler } from '../src/lib/klip-tespit.js';

// 600 sn sakin yayın; 300-305 arası bağırma
const rms = Array.from({ length: 600 }, (_, i) => (i >= 300 && i < 305 ? 0.6 : 0.1 + (i % 7) * 0.005));

test('ses: yükseklik sıçraması doğru yerde bulunur', () => {
  const s = sesSicramalari(rms);
  const b = s.find((x) => x.bas <= 300 && x.son >= 305);
  assert.ok(b, JSON.stringify(s.slice(0, 5)));
  assert.ok(b.puan > 90);
});

test('sohbet: mesaj patlaması ve heyecan kelimesi', () => {
  const m = [];
  for (let t = 0; t < 600; t += 4) m.push({ t, metin: 'hi' });
  for (let i = 0; i < 40; i++) m.push({ t: 302 + (i % 8) / 2, metin: i % 2 ? 'LMAO' : 'NO WAY 💀' });
  const s = sohbetSicramalari(m);
  assert.ok(s.some((x) => x.bas <= 302 && x.son >= 303), JSON.stringify(s));
});

test('ısı haritası ve yorum zaman damgaları', () => {
  const h = Array.from({ length: 100 }, (_, i) => ({ start_time: i * 6, end_time: i * 6 + 6, value: i === 50 ? 1 : 0.2 }));
  assert.deepEqual(haritaSicramalari(h).map((x) => x.bas), [300]);
  assert.deepEqual(zamanDamgalari('5:02 lol and 1:02:33, not 99:99 or 2024'), [302, 3753]);
  const y = yorumSicramalari([{ metin: '5:01 💀', begeni: 120 }, { metin: 'at 5:04 he lost it', begeni: 3 }], 600);
  assert.equal(y.length, 1);
  assert.ok(y[0].bas <= 301 && y[0].son >= 304);
});

test('puanlama: farklı sinyaller aynı anda olursa kombo, kesit 12-45 sn', () => {
  const p = puanla([
    { bas: 300, son: 305, puan: 80, tur: 'ses' },
    { bas: 302, son: 307, puan: 70, tur: 'sohbet' },
    { bas: 100, son: 104, puan: 95, tur: 'ses' },
  ]);
  assert.equal(p[0].bas, 300);
  assert.deepEqual(Object.keys(p[0].sinyaller).sort(), ['ses', 'sohbet']);
  assert.deepEqual(kesitAraligi({ bas: 300, son: 302 }, 600), { bas: 294.5, son: 306.5 });
  const uzun = kesitAraligi({ bas: 100, son: 200 }, 600);
  assert.equal(uzun.son - uzun.bas, 45);
  const k = enIyiKesitler({ rms, sure: 600, harita: [{ start_time: 300, end_time: 306, value: 1 }] }, 3);
  assert.ok(k[0].bas >= 299 && k[0].bas <= 301 && k[0].sinyaller.harita, JSON.stringify(k[0]));
});
