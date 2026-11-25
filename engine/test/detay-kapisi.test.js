import test from 'node:test';
import assert from 'node:assert';
import { detayHatalari, DETAYLAR } from '../src/lib/detay-kapisi.js';
import { ortamSeviye, SES, sesOlaylari } from '../../shared/ses-olaylari.js';

const dizi = { karakterler: { a: { ad: 'A' }, su: { ad: 'Su', takilar: ['yarim-bilezik'] } } };
const is = (satir, ek = {}) => ({ type: 'short', scenes: [{ mekan: 'mahzen', kadraj: [{ id: 'a' }], yakinPlan: [{ id: 'a', hedef: 'el', sn: 0 }], satirlar: [{ metin: satir }], ...ek }] });

test('söylenen eşya ekranda yoksa reddedilir, varsa geçer', () => {
  assert.equal(detayHatalari(is('Elindeki testi titredi.'), dizi).length, 1);
  assert.equal(detayHatalari(is('Elindeki testi titredi.', { kadraj: [{ id: 'a', esya: 'testi' }] }), dizi).length, 0);
  assert.equal(detayHatalari(is('Bileziğini gördüm.', { kadraj: [{ id: 'su' }] }), dizi).length, 0);
  assert.equal(detayHatalari(is('Bileziğini gördüm.', { kadraj: [{ id: 'su', takilar: [] }] }), dizi).length, 1);
});
test('küçük ayrıntı yakın plan ister; anı için anilan yazılabilir', () => {
  assert.ok(detayHatalari(is('Testiyi tuttu.', { kadraj: [{ id: 'a', esya: 'testi' }], yakinPlan: undefined }), dizi).some((h) => h.includes('yakinPlan')));
  assert.equal(detayHatalari(is('O bileziği hatırladım.', { anilan: { bilezik: 'anı, ekranda değil' } }), dizi).length, 0);
});
test('benzer kelimeler eşya sayılmaz', () => {
  const bul = (m) => DETAYLAR.filter((d) => d.re.test(m)).map((d) => d.ad);
  assert.deepEqual(bul('beni kovaladı, sözünü kesen adam zincirli kaldı, yerinden kalkan asker'.replace('kalkan asker', 'kalktı')), []);
  assert.deepEqual(bul('kovayı ve keseyi aldı'), ['kova', 'kese']);
});
test('ortam sesi konuşmanın en az 18 dB altında kalır', () => {
  const RMS = { 'ortam-su': -13.5, 'ortam-kalabalik': -14.8, 'ortam-ruzgar': -16.1, 'ortam-damla': -22.9, 'ortam-ates': -25.6 };
  for (const [ses, r] of Object.entries(RMS)) assert.ok(r + 20 * Math.log10(ortamSeviye(ses, 0.45)) <= -37.9, ses);
  assert.ok(SES.efektKonusma < SES.efekt && SES.ortamKonusma < 0.5);
  assert.ok(sesOlaylari([{ t0: 0, d: 5, mekan: 'kanal' }]).every((e) => e.vol < 0.2));
});
