import test from 'node:test';
import assert from 'node:assert/strict';
import { okunacaklar, sik } from '../src/rutin-ozet.js';
test('rutin özeti: yalnız gereken bölümler listelenir', () => {
  const k = [{ id: 'A', enabled: true }, { id: 'B', enabled: false }];
  const f = okunacaklar({ needed: [{ format: 'dizi', masterV4: true }], kanallar: k, perf: { B: { raporGerekli: true } }, kesif: {}, istek: [], yorum: [] });
  assert.ok(f.includes('routine/MASTER-v4.md') && f.includes('routine/bolumler/dizi.md'));
  assert.ok(!f.some((x) => /cizim|haftalik|analiz|yorum|kesif/.test(x)));
  assert.ok(okunacaklar({ needed: [], kanallar: k, perf: { A: { raporGerekli: true } }, kesif: {}, istek: [], yorum: [{}] }).includes('routine/bolumler/haftalik.md'));
  assert.deepEqual(sik({ a: null, b: [], c: 1.2345, d: { e: 'x' } }), { c: 1.23, d: { e: 'x' } });
});
