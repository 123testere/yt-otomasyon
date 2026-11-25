// node --test test/  — Master Prompt v4 yayın kapısı (ağsız).
import test from 'node:test';
import assert from 'node:assert/strict';
import { v4Hatalari, bolumZamanHatalari, kontrolMaddeleri, v4Kanal } from '../src/lib/master-v4.js';

const LAMBA = 'UCPtL84Agfh5hzoTQqE4jD0w';
const evet = (tip) => Object.fromEntries(kontrolMaddeleri(tip).map((m) => [m, 'evet: kontrol edildi']));
const uzun = {
  id: 'x', channelId: LAMBA, type: 'long', format: 'cizim', title: 'Zipper: 1893\'te Kimse İstemedi',
  basliklar: ['Zipper: 1893\'te Kimse İstemedi', 'Fermuarı Kimse Almadı', 'Fermuar 20 Yıl Satılmadı'],
  thumbnailText: 'KİMSE ALMADI', thumbnailTextAlt: '20 YIL', thumbnailTextAlt2: '1893',
  oynatmaListesi: 'Eşyaların Hikâyesi', tags: ['fermuar', 'zipper', 'fermuar tarihi'],
  kaynaklar: [{ url: 'https://www.britannica.com/technology/zipper', not: '1893 patent' }],
  scenes: [{ bolum: { ad: 'Giriş' } }, { bolum: { ad: 'Patent' } }, { bolum: { ad: 'Satış' } }],
  kontrol: evet('long'), description: '', paket: { merak: 'Neden satılmadı?', cevap: 'Çünkü kimse alışmadı', cevapSahne: 3, kapakAni: 'Satış sahnesi' },
};
const kisa = {
  id: 'y', channelId: LAMBA, type: 'short', title: 'Fermuar 20 yıl satılmadı', ilgiliVideo: '2026-11-25_x_long1',
  tags: ['fermuar'], kaynaklar: ['https://www.britannica.com/technology/zipper'], kontrol: evet('short'), description: '', scenes: [{}, {}], paket: { merak: 'Neden satılmadı?', cevap: 'Çünkü kimse alışmadı', cevapSahne: 2, kapakAni: 'İlk karede' },
};

test('v4: kapsam — muaf kanal ve kesit kontrol edilmez', () => {
  assert.equal(v4Kanal(LAMBA), true);
  assert.equal(v4Kanal('UCyLqvRzGPIsjgOvr7RUxycA'), false);
  assert.deepEqual(v4Hatalari({ ...uzun, channelId: 'UCyLqvRzGPIsjgOvr7RUxycA' }), []);
});

test('v4: eksiksiz uzun video ve Shorts kapıdan geçer', () => {
  assert.deepEqual(v4Hatalari(uzun), []);
  assert.deepEqual(v4Hatalari(kisa), []);
});

test('v4: tek eksik madde videoyu durdurur', () => {
  const h = (j) => v4Hatalari(j).join(' | ');
  assert.match(h({ ...uzun, kaynaklar: [] }), /O3/);
  assert.match(h({ ...uzun, title: 'x'.repeat(51) }), /U2/);
  assert.match(h({ ...uzun, basliklar: ['a', 'a', 'b'] }), /U1/);
  assert.match(h({ ...uzun, oynatmaListesi: '' }), /U9/);
  assert.match(h({ ...uzun, scenes: [{ bolum: { ad: 'a' } }, {}] }), /U6/);
  assert.match(h({ ...uzun, paket: undefined }), /paket/);
  assert.match(h({ ...uzun, paket: { ...uzun.paket, cevapSahne: 1 } }), /ikinci yarı/);
  assert.match(h({ ...uzun, tags: Array(7).fill('t') }), /O12/);
  assert.match(h({ ...uzun, kontrol: { ...evet('long'), U3: 'hayır' } }), /§6.*U3/);
  assert.match(h({ ...uzun, description: 'tarih [DOĞRULANMALI]' }), /DOĞRULANMALI/);
  assert.match(h({ ...kisa, title: 'x'.repeat(41) }), /S6/);
  assert.match(h({ ...kisa, ilgiliVideo: '' }), /S4/);
  assert.match(h({ ...kisa, description: 'Abone ol kazan, çekiliş var' }), /O6/);
  // kurgu dizi bölümünde kaynak yerine kurgu: true
  assert.doesNotMatch(h({ ...uzun, format: 'dizi', kurgu: true, kaynaklar: [] }), /O3/);
});

test('v4 U6: bölüm zamanları', () => {
  assert.deepEqual(bolumZamanHatalari([0, 30, 90], 200), []);
  assert.match(bolumZamanHatalari([0, 5, 90], 200).join(), /en az 10/);
  assert.match(bolumZamanHatalari([0, 60], 200).join(), /en az 3/);
});
