import test from 'node:test';
import assert from 'node:assert';
import { etkilesimHatalari } from '../src/lib/etkilesim.js';
import { cizimHatasi, derle, kelimeSaati } from '../../shared/cizim.js';

const is = (ek = {}) => ({ format: 'cizim', soru: { metin: 'Sence neden hiç çalmadı?', a: 'Çatladı', b: 'Hiç asılamadı', dogru: 'a' }, scenes: [
  { narration: 'Dünyanın en ağır çanı hiç çalmadı. Sence neden?', cizim: "ink(ln([0,0],[1,1]),{pp:pr(u,w('çanı'),w('çanı')+.5)});" },
  { narration: 'Yangında soğuk su değdi.', cizim: 'ink(ln([0,0],[1,1]));' },
  { narration: 'Doğru cevap: çatladı. Kaçırmamak için abone olun, takip edin.', cizim: "txt('x',1,1,9,{a:pr(u,w('çatladı'),2)});" },
], ...ek });

test('etkileşim: soru, ikinci yarıda cevap, son cümle abone', () => {
  assert.deepEqual(etkilesimHatalari(is()), []);
  assert.ok(etkilesimHatalari(is({ soru: undefined }))[0].includes('soru'));
  const sonsuz = is(); sonsuz.scenes[2].narration = 'Doğru cevap: çatladı.';
  assert.ok(etkilesimHatalari(sonsuz).some((h) => h.includes('abone')));
  const cevapsiz = is(); cevapsiz.scenes[2].narration = 'Bugün Kremlin’de duruyor. Abone olun.';
  assert.ok(etkilesimHatalari(cevapsiz).some((h) => h.includes('doğru cevabı')));
});
test('çizim w() ile söze bağlanır; kelime saati bulunur', () => {
  const w = kelimeSaati([{ text: 'Çan', u: 0.4 }, { text: 'çatladı.', u: 2.5 }], 0);
  assert.equal(w('çatladı'), 2.5);
  assert.equal(w('yok'), 0);
  assert.equal(cizimHatasi("txt('a',1,1,9,{a:pr(u,w('x'),1)});"), null);
  let goruldu = null;
  derle("goruldu(w('çan'));".replace('goruldu', 'K.f'), w)({ K: { f: (v) => { goruldu = v; } } }, 0);
  assert.equal(goruldu, 0.4);
});
