// Bölüm Bölüm — 3B örnek: üç mekânda savaş (zindan → gece suru → arena), 15 sn, yatay, konuşmasız.
import * as THREE from 'three';
import { stoneTex, woodTex, painted, flat, rng } from '/engine/src/paint.js';
import { CamPath, smoother } from '/engine/src/camera.js';
import { Smoke, beam, glow } from '/engine/src/fx.js';
import { Kart } from '/bizim/kart.js';
import { cop } from '/bizim/cop.js';

export const NAME = 'zincirli-3b', FPS = 30, DUR = 15, CUES = [];
const V = (...a) => new THREE.Vector3(...a), HDR = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const M = 1.78 / 520;                        // 1 çizim birimi = kaç metre
let DEF, kart = {}, sets = {}, dyn = {}, cam1;
const X = { zindan: 0, sur: 200, arena: 400 };

// ---- zaman: surda kılıç Arın'ın başının üstünden geçerken yavaşlar (gerçek 6,35-7,55 sn)
const YAV = [6.3, 7.5, .3];
const oyun = t => t < YAV[0] ? t : t < YAV[1] ? YAV[0] + (t - YAV[0]) * YAV[2] : YAV[0] + (YAV[1] - YAV[0]) * YAV[2] + (t - YAV[1]) * 1;
const geri = YAV[1] - YAV[0] - (YAV[1] - YAV[0]) * YAV[2];   // 0,84: yavaş çekimden sonraki anlar "oyun" saatinde bu kadar geride

// ---- koreografi: [t, x, poz, yon?]; x doğrusal kayar. Oyun saatiyle.
const K = {
  zindan: {
    arin: [[0, -3.6, 'kos', 1], [.95, -.75, 'kilic-kaldir'], [1.45, -.72, 'kilic-indir'], [1.95, -.7, 'kilic-kaldir'], [2.4, -.62, 'kilic-indir'], [2.95, -.6, 'kilic-hazir'], [3.3, -.6, 'blok'], [3.85, -.6, 'kilic-kaldir'], [4.25, -.5, 'kilic-indir'], [4.75, -.45, 'kilic-hazir'], [5, -.45, 'kilic-hazir']],
    m1: [[0, 3.2, 'kos', -1], [.95, .62, 'kilic-hazir'], [1.3, .62, 'blok'], [1.9, .66, 'kilic-hazir'], [2.56, .66, 'darbe'], [2.75, .8, 'dus'], [3.35, 1.25, 'yerde'], [5, 1.25, 'yerde']],
    m2: [[0, 5, 'kos', -1], [1.4, 2.5, 'kilic-hazir'], [2.75, 2.4, 'kos'], [3.15, .75, 'kilic-kaldir'], [3.3, .72, 'kilic-indir'], [3.9, .74, 'kilic-hazir'], [4.41, .75, 'darbe'], [4.6, .9, 'dus'], [5, 1.5, 'yerde']],
  },
  sur: {   // 5..10 gerçek; oyun saati 5..9,16
    kargan: [[5, -.75, 'kilic-hazir', -1], [5.35, -.75, 'kilic-kaldir'], [5.75, -.85, 'kilic-indir'], [6.2, -.85, 'kilic-kaldir'], [7.5, -.95, 'kilic-indir'], [8.2, -.95, 'kilic-hazir'], [9.2, -.95, 'kilic-hazir']],
    arin: [[5, .25, 'kilic-hazir', 1], [5.5, .25, 'blok'], [6.1, .25, 'kilic-hazir'], [6.24, .25, 'diz-cok'], [6.95, .3, 'kilic-kaldir'], [7.2, .4, 'kilic-indir'], [7.75, .45, 'kilic-hazir'], [9.2, .45, 'kilic-hazir']],
    m1: [[5, 2.6, 'kos', -1], [5.35, 1.55, 'kilic-kaldir'], [5.5, 1.5, 'kilic-indir'], [5.95, 1.5, 'kilic-kaldir'], [6.3, 1.4, 'kilic-indir'], [7.0, 1.45, 'kilic-hazir'], [7.36, 1.5, 'darbe'], [7.55, 1.6, 'dus'], [8.15, 2.2, 'yerde'], [9.2, 2.2, 'yerde']],
    m2: [[5, -3.6, 'kos', 1], [5.5, -2.3, 'kilic-hazir'], [5.6, -2.3, 'blok'], [6.3, -2.3, 'kilic-hazir'], [7.66, -2.3, 'darbe'], [7.85, -2.4, 'dus'], [8.4, -2.9, 'yerde'], [9.2, -2.9, 'yerde']],
  },
  arena: {
    arin: [[10, -2.6, 'kos', 1], [10.75, -.68, 'kilic-kaldir'], [11, -.68, 'kilic-indir'], [11.5, -.7, 'blok'], [12.05, -.8, 'kilic-kaldir'], [12.35, -.7, 'kilic-indir'], [12.85, -.72, 'kilic-kaldir'], [13.2, -.6, 'kilic-indir'], [15, -.56, 'kilic-indir']],
    sungur: [[10, 2.6, 'kos', -1], [10.75, .68, 'kilic-hazir'], [10.9, .68, 'blok'], [11.35, .68, 'kilic-kaldir'], [11.55, .64, 'kilic-indir'], [12.2, .7, 'blok'], [12.85, .72, 'kilic-kaldir'], [13.2, .6, 'kilic-indir'], [15, .56, 'kilic-indir']],
  },
};
const ESYA = { kargan: 'kilic', arin: 'kilic', m1: 'kilic', m2: 'kilic', sungur: 'kilic' };
// kılıç çarpmaları (gerçek sn): yer ve şiddet; düşme ve savurma sesleri de buradan
const G = { zindan: t => t, sur: t => t < YAV[0] ? t : t <= YAV[0] + .36 ? YAV[0] + (t - YAV[0]) / YAV[2] : t + geri, arena: t => t };
const VUR = [];
const vur = (set, o, x, y, g = 1, ses = 'carpma') => VUR.push({ set, t: G[set](o), x: X[set] + x, y, g, ses });
vur('zindan', 1.6, .45, 1.12); vur('zindan', 2.55, .62, 1.05, 1.2, 'darbe'); vur('zindan', 3.46, .05, 1.15); vur('zindan', 4.41, .72, 1.05, 1.3, 'darbe');
vur('sur', 5.66, .9, 1.25); vur('sur', 5.91, -2.1, 1.25, 1.3); vur('sur', 7.36, 1.5, 1.05, 1.2, 'darbe'); vur('sur', 7.66, -2.2, 1.2, 1.5, 'darbe');
vur('arena', 11.15, .42, 1.15, 1.2); vur('arena', 11.7, -.4, 1.15); vur('arena', 12.5, .42, 1.15, 1.2); vur('arena', 13.36, 0, 1.18, 2);
export { VUR };
const SON = 13.36;   // kılıçlar kilitlenir

function durum(keys, t) {
  let i = 0; while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
  const a = keys[i], b = keys[i + 1], on = keys[i - 1];
  let yon = 1; for (let k = 0; k <= i; k++) if (keys[k][3]) yon = keys[k][3];
  return { x: b ? a[1] + (b[1] - a[1]) * cl((t - a[0]) / (b[0] - a[0])) : a[1], poz: a[2], pozU: t - a[0], yon, gecis: on ? { poz: on[2], u: t - a[0] } : null };
}

// ---- ortak
function mesh(g, geo, mat, x, y, z, o = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.r) m.rotation.set(...o.r); if (o.golgesiz) m.userData.noShadow = true; g.add(m); return m; }
function golgele(g) { g.traverse(o => { if (!o.isMesh) return; if (o.material.isMeshLambertMaterial) o.receiveShadow = true; if (/Box|Cylinder|Lathe|Torus|Sphere|Dodeca/.test(o.geometry.type) && !o.userData.noShadow) o.castShadow = true; }); }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 14) => new THREE.CylinderGeometry(a, b, h, n);
function tuval(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function spot(color, k, pos, hedef, aci, { near = 1, far = 40, map } = {}) {
  const l = new THREE.SpotLight(color, k, 0, aci, .4, 0); l.position.set(...pos); l.target.position.set(...hedef); l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048); l.shadow.camera.near = near; l.shadow.camera.far = far; l.shadow.bias = -.0006; l.shadow.normalBias = .03; l.shadow.radius = 3; if (map) l.map = map; return l;
}
function alev() {            // meşale alevi: iç içe üç HDR koni
  const g = new THREE.Group();
  for (const [r, h, c] of [[.11, .42, HDR(2.6, .95, .2)], [.075, .3, HDR(3.4, 1.9, .5)], [.04, .18, HDR(4.2, 3.6, 2.2)]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), new THREE.MeshBasicMaterial({ color: c })); m.position.y = h / 2; g.add(m); }
  return g;
}
dyn.alev = [];
function mesale(g, L, scene, x, y, z, kuvvet = 9, menzil = 9) {
  mesh(g, cyl(.05, .035, .6), flat('#6a4426'), x, y - .3, z, { golgesiz: true }); mesh(g, cyl(.1, .07, .14), flat('#3a3444'), x, y, z, { golgesiz: true });
  const a = alev(); a.position.set(x, y + .05, z); g.add(a);
  const p = new THREE.PointLight('#ffb468', kuvvet, menzil, 1.4); p.position.set(g.position.x + x, y + .35, z + .35); L.add(p);
  const h = glow(scene, [g.position.x + x, y + .25, z + .06], '#ff9a40', 1.5, .3);
  dyn.alev.push({ a, p, k: kuvvet, h, s: dyn.alev.length * 1.7 });
}
// ---- ZİNDAN
function zindan(scene) {
  const g = new THREE.Group(); scene.add(g); const L = new THREE.Group(); scene.add(L);
  mesh(g, new THREE.PlaneGeometry(26, 14), painted(stoneTex({ base: '#8d86a6', bw: 128, bh: 128, rep: [8, 4] })), 0, 0, 1, { r: [-Math.PI / 2, 0, 0] });
  const t = painted(stoneTex({ base: '#8f86b0', bw: 128, bh: 64, rep: [6, 1.6] }));
  mesh(g, new THREE.PlaneGeometry(26, 6), t, 0, 3, -3.2);
  mesh(g, new THREE.PlaneGeometry(26, 12), painted(stoneTex({ base: '#5a5474', rep: [6, 3] })), 0, 5.2, 0, { r: [Math.PI / 2, 0, 0] });
  const st = painted(stoneTex({ base: '#a59cc0', bw: 256, bh: 128, rep: [1, 2] }));
  for (const x of [-5.4, -1.9, 1.9, 5.4]) {              // payandalar + kemer ayakları
    mesh(g, box(.75, 5.2, .9), st, x, 2.6, -2.9); mesh(g, box(1, .28, 1.1), st, x, .14, -2.85); mesh(g, box(.95, .25, 1.05), st, x, 3.3, -2.85);
  }
  for (const x of [-3.65, 0, 3.65]) {
    const a = mesh(g, new THREE.TorusGeometry(1.42, .2, 8, 28, Math.PI), st, x, 3.3, -2.8);
    mesh(g, new THREE.CircleGeometry(1.3, 24, 0, Math.PI), flat('#1c1730'), x, 3.3, -3.14);
  }
  // hücre parmaklıkları
  const demir = flat('#4a4660');
  for (const x0 of [-3.65, 3.65]) {
    mesh(g, new THREE.PlaneGeometry(2.6, 3.3), flat('#191430'), x0, 1.65, -3.12);
    for (let k = -5; k <= 5; k++) mesh(g, cyl(.035, .035, 3.3, 8), demir, x0 + k * .23, 1.65, -2.75);
    for (const y of [.5, 1.7, 2.9]) mesh(g, box(2.6, .08, .06), demir, x0, y, -2.72);
  }
  // ağır ahşap kapı
  const ah = painted(woodTex({ base: '#8d7058', rep: [1, 1], vertical: true }));
  mesh(g, box(2.3, 3.2, .2), ah, 0, 1.6, -3.0); for (const y of [.6, 1.6, 2.6]) mesh(g, box(2.3, .16, .08), demir, 0, y, -2.86);
  mesh(g, new THREE.TorusGeometry(.16, .03, 8, 20), demir, .7, 1.5, -2.8);
  // duvardan sarkan zincirler
  dyn.zincir = [];
  for (const [x, n] of [[-1.9, 9], [1.9, 7], [5.4, 10]]) { const z = new THREE.Group(); z.position.set(x, 3.1, -2.38); for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.TorusGeometry(.065, .018, 6, 12), demir); b.position.y = -k * .12; b.rotation.y = k % 2 ? Math.PI / 2 : 0; b.scale.y = 1.35; z.add(b); } g.add(z); dyn.zincir.push(z); }
  // fıçı, sandık, saman; yakın planda sütun
  const fici = (x, z) => { mesh(g, cyl(.36, .36, .95, 18), ah, x, .48, z); for (const y of [.18, .78]) mesh(g, new THREE.TorusGeometry(.37, .03, 6, 24), demir, x, y, z, { r: [Math.PI / 2, 0, 0] }); };
  fici(-4.6, -1.9); fici(-5.35, -1.5); fici(4.9, -2); mesh(g, box(.9, .7, .7), ah, 5.8, .35, -1.6, { r: [0, .3, 0] });
  mesh(g, cyl(.34, .4, 5.2, 18), st, -4.5, 2.6, 2.6); mesh(g, cyl(.34, .4, 5.2, 18), st, 5.0, 2.6, 2.4);
  mesale(g, L, scene, -1.9, 2.3, -2.2, 4.6, 10); mesale(g, L, scene, 1.9, 2.3, -2.2, 4.6, 10);
  L.add(new THREE.HemisphereLight('#7f8cf0', '#3c2f66', 1.35));
  const s = spot('#ffb468', 2.1, [-1.2, 4.6, 4.5], [.2, .4, -1.4], .75, { far: 16 }); L.add(s, s.target);
  const m = spot('#8fb0ff', 1.6, [6, 5, 3.6], [.5, .3, -.4], .5, { far: 18 }); L.add(m, m.target);
  sets.zindan = { g, L }; golgele(g);
  dyn.isik = beam(scene, [4.4, 5.1, .6], [2.0, 0, -.6], { r0: .35, r1: 1, color: '#a9c0ff', strength: .22 });
}
// ---- GECE SURU
function sur(scene) {
  const g = new THREE.Group(); g.position.x = 200; scene.add(g); const L = new THREE.Group(); scene.add(L);
  const gok = tuval(2048, 1024, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c3a86'); gr.addColorStop(.6, '#6a74c4'); gr.addColorStop(1, '#a79ad8'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const R = rng(8); for (let i = 0; i < 170; i++) { c.fillStyle = `rgba(255,255,255,${.4 + R() * .6})`; c.beginPath(); c.arc(R() * w, R() * h * .6, 1 + R() * 2.4, 0, 7); c.fill(); }
    for (const [y, r, n] of [['#6a70b4', 620, 1], ['#51569c', 700, 2], ['#3c3f80', 790, 3]]) { c.fillStyle = y; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 16) c.lineTo(x, r - 70 * Math.sin(x * .004 * n + n) - 36 * Math.sin(x * .013 + n * 2)); c.lineTo(w, h); c.fill(); }
    const R2 = rng(4); for (let i = 0; i < 46; i++) { const x = 300 + R2() * 1400, y = 830 + R2() * 110; c.fillStyle = '#2c2c62'; c.fillRect(x, y, 34, 30); c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 17, y - 18); c.lineTo(x + 40, y); c.fill(); c.fillStyle = '#ffd27a'; c.fillRect(x + 12, y + 9, 9, 10); }
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(220,220,255,.16)'; c.beginPath(); c.ellipse(R2() * w, 180 + R2() * 330, 160 + R2() * 180, 16 + R2() * 16, 0, 0, 7); c.fill(); }
  });
  mesh(g, new THREE.PlaneGeometry(56, 28), new THREE.MeshBasicMaterial({ map: gok }), 0, 6.5, -24);
  const ay = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), new THREE.MeshBasicMaterial({ color: HDR(1.7, 1.75, 1.9) })); ay.position.set(6.5, 10.2, -23); g.add(ay);
  const t = stoneTex({ base: '#a2a6d0', bw: 128, bh: 64, rep: [7, .5] });
  mesh(g, new THREE.PlaneGeometry(28, 6), painted(stoneTex({ base: '#9a9cc4', bw: 128, bh: 128, rep: [8, 2] })), 0, 0, .6, { r: [-Math.PI / 2, 0, 0] });
  mesh(g, box(28, 1, .7), painted(t), 0, .5, -2.4);
  const dis = painted(stoneTex({ base: '#a8aad6', bw: 256, bh: 128 }));
  for (let x = -12; x <= 12; x += 1.9) { mesh(g, box(1.05, .85, .7), dis, x, 1.42, -2.4); mesh(g, box(1.2, .1, .84), dis, x, 1.9, -2.4); }
  mesh(g, cyl(1.9, 2.1, 9, 28), painted(stoneTex({ base: '#8f92c0', rep: [5, 4] })), -7.2, 4.5, -4.6); mesh(g, new THREE.ConeGeometry(2.5, 2.6, 28), flat('#a8404e'), -7.2, 10.2, -4.6);
  mesh(g, new THREE.PlaneGeometry(.5, 1.0), new THREE.MeshBasicMaterial({ color: HDR(2, 1.25, .5) }), -6.5, 5.6, -2.62);
  // sancaklar (rüzgârda dalgalanır)
  dyn.sancak = [];
  for (const x of [-4.2, 4.6]) { mesh(g, cyl(.04, .05, 4, 8), flat('#6a4a34'), x, 2.6, -2.4); const b = mesh(g, new THREE.PlaneGeometry(1.5, .9, 16, 1), painted(tuval(256, 150, (c, w, h) => { c.fillStyle = '#c8323e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f0c050'; c.lineWidth = 14; c.strokeRect(12, 12, w - 24, h - 24); c.beginPath(); c.arc(w / 2, h / 2, 30, 0, 7); c.stroke(); }), { side: THREE.DoubleSide }), x + .8, 4.1, -2.4); dyn.sancak.push(b); }
  mesale(g, L, scene, -2.7, 1.9, -1.95, 9, 7); mesale(g, L, scene, 2.95, 1.9, -1.95, 9, 7);
  L.add(new THREE.HemisphereLight('#8ea2ff', '#4a4280', 1.7));
  const s = spot('#b4c6ff', 2.4, [206, 9, -9], [200, .2, .6], .6, { far: 26 }); L.add(s, s.target);
  const d = spot('#ffc890', .9, [197, 4.5, 6], [200, 1, -1], .7, { far: 16 }); L.add(d, d.target);
  sets.sur = { g, L }; golgele(g);
}
// ---- ARENA
function arena(scene) {
  const g = new THREE.Group(); g.position.x = 400; scene.add(g); const L = new THREE.Group(); scene.add(L);
  const kum = tuval(1024, 1024, (c, w) => { c.fillStyle = '#f0cf94'; c.fillRect(0, 0, w, w); const R = rng(3); for (let i = 0; i < 900; i++) { c.fillStyle = i % 2 ? 'rgba(200,150,90,.16)' : 'rgba(255,240,205,.2)'; c.beginPath(); c.ellipse(R() * w, R() * w, 4 + R() * 24, 2 + R() * 7, 0, 0, 7); c.fill(); } });
  mesh(g, new THREE.PlaneGeometry(40, 30), painted(kum), 0, 0, 0, { r: [-Math.PI / 2, 0, 0] });
  mesh(g, new THREE.PlaneGeometry(90, 30), new THREE.MeshBasicMaterial({ map: tuval(512, 256, (c, w, h) => { const r = c.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#5b9cf0'); r.addColorStop(1, '#d8ecff'); c.fillStyle = r; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y] of [[90, 80], [300, 60], [430, 110]]) for (const k of [-24, 0, 24]) { c.beginPath(); c.ellipse(x + k, y + Math.abs(k) * .2, 26, 12, 0, 0, 7); c.fill(); } }) }), 0, 12, -26);
  mesh(g, box(44, 2.1, .8), painted(stoneTex({ base: '#e6c48e', bw: 128, bh: 64, rep: [10, 1] })), 0, 1.05, -8); mesh(g, box(44, .22, 1.1), flat('#c8323e'), 0, 2.2, -8);
  // üç sıra tribün + seyirci (boyalı)
  const sey = k => tuval(2048, 256, (c, w, h) => { const R = rng(20 + k), r = ['#c8404a', '#3d86c9', '#e0a83c', '#6aa85a', '#8a5ab0', '#e8e0d0', '#d8743c']; for (let i = 0; i < 58; i++) { const x = 16 + i * 35 + R() * 10, y = 112 + R() * 24; c.lineWidth = 5; c.strokeStyle = '#1a1424'; c.fillStyle = r[R() * 7 | 0]; c.beginPath(); c.roundRect(x - 17, y + 10, 34, 140, 13); c.fill(); c.stroke(); c.fillStyle = '#f3ead7'; c.beginPath(); c.arc(x, y - 6, 18, 0, 7); c.fill(); c.stroke(); if (R() > .5) { c.beginPath(); c.moveTo(x - 14, y + 18); c.lineTo(x - 22, y - 48); c.moveTo(x + 14, y + 18); c.lineTo(x + 22, y - 48); c.stroke(); } c.fillStyle = '#1a1424'; c.beginPath(); c.arc(x - 6, y - 8, 2.6, 0, 7); c.arc(x + 6, y - 8, 2.6, 0, 7); c.arc(x, y + 2, 4, 0, 7); c.fill(); } });
  dyn.seyirci = [];
  for (let k = 0; k < 3; k++) { mesh(g, box(44, 1.1, 1.6), painted(stoneTex({ base: '#dcb880', rep: [12, 1] })), 0, 2.3 + k * 1.15, -9.4 - k * 1.5); const m = mesh(g, new THREE.PlaneGeometry(42, 2.2), new THREE.MeshBasicMaterial({ map: sey(k), transparent: true, alphaTest: .3 }), 0, 3.2 + k * 1.15, -8.75 - k * 1.5); dyn.seyirci.push(m); }
  for (const x of [-13, -6.5, 6.5, 13]) { mesh(g, cyl(.35, .4, 8, 16), painted(stoneTex({ base: '#f0d8a8', rep: [1, 3] })), x, 4, -8.4); mesh(g, box(1.1, .3, 1.1), flat('#f0d8a8'), x, 8.1, -8.4); }
  dyn.sancak2 = [];
  for (const x of [-9.7, 0, 9.7]) dyn.sancak2.push(mesh(g, new THREE.PlaneGeometry(1.5, 3.6, 1, 12), painted(tuval(160, 400, (c, w, h) => { c.fillStyle = x ? '#5a1e6a' : '#c8323e'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * .85); c.lineTo(w / 2, h); c.lineTo(0, h * .85); c.fill(); c.strokeStyle = '#f0c050'; c.lineWidth = 12; c.stroke(); c.beginPath(); c.arc(w / 2, h * .4, 40, 0, 7); c.stroke(); }), { transparent: true, alphaTest: .4, side: THREE.DoubleSide }), x, 4.6, -7.5));
  for (const [x, z, r] of [[-4.6, -3.2, .5], [5.2, -4, .4], [-6.6, 1.4, .3]]) mesh(g, new THREE.DodecahedronGeometry(r), flat('#c8a878'), x, r * .5, z);
  mesh(g, cyl(.06, .06, 3.2, 8), flat('#7a5230'), 3.4, 1.2, -2.8, { r: [0, 0, .5] });
  L.add(new THREE.HemisphereLight('#cfe0ff', '#a89adc', 1.75));
  const s = spot('#ffdca0', 2.7, [408, 13, 7], [400, 0, -2], .62, { far: 40 }); L.add(s, s.target);
  sets.arena = { g, L }; golgele(g);
}
export async function setup(ctx) {
  const { scene } = ctx; scene.background = new THREE.Color('#1a1f3a');
  DEF = (await (await fetch('/bizim/zincirli.json')).json()).karakterler;
  zindan(scene); sur(scene); arena(scene);
  const tanim = { arin: DEF.arin, kargan: { ...DEF.kargan, olcek: 1.2 }, sungur: DEF.sungur, m1: DEF.muhafiz, m2: { ...DEF.muhafiz, seed: 31 } };
  for (const [k, def] of Object.entries(tanim)) kart[k] = new Kart(scene, { w: 1900, h: 1250, ox: 950, oy: 1150, metre: M * .75, ciz: (c, x, y, o) => cop(c, def, { ...o, x, y, s: 1 / .75 }) });
  // kıvılcımlar
  const N = 42; dyn.kiv = VUR.map(() => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: HDR(4, 2.6, .9), transparent: true })); m.layers.set(1); m.frustumCulled = false; m.renderOrder = 30; scene.add(m); return m; });
  dyn.flas = new THREE.PointLight('#ffd890', 0, 5, 1.2); scene.add(dyn.flas);
  dyn.yildiz = glow(scene, [0, -50, 0], '#fff0c0', 1, .9); dyn.yildiz.material.depthTest = false; dyn.yildiz.renderOrder = 31;
  // toz (koşu/arena) ve havada uçuşan zerreler
  dyn.toz = new Smoke(scene, { color: '#f0d8a8', maxPoints: 900, H: ctx.H }); dyn.zer = new Smoke(scene, { color: '#ffd8a0', maxPoints: 500, H: ctx.H, additive: true, near: 1.5 });
  const h = (i, k) => { const x = Math.sin(i * 12.99 + k * 78.2) * 43758.5; return x - Math.floor(x); };
  for (const s of [-1, 1]) dyn.toz.wisps.push({ n: 60, size: .34, alpha: .28, speed: 1.1, seed: s, on: t => t > 10 && t < 13.6, path: (u, t, i) => { const x = durum(K.arena[s < 0 ? 'arin' : 'sungur'], t).x; return [400 + x + s * (u * .9 + h(i, 1) * .5), .06 + u * .4 * h(i, 2), (h(i, 3) - .5) * .7]; } });
  for (const [cx, a, b] of [[0, 0, 5], [200, 5, 10], [400, 10, 15]]) dyn.zer.wisps.push({ n: 110, size: .014, alpha: .6, speed: .07, on: t => t >= a && t < b, path: (u, t, i) => [cx + (h(i, 1) - .5) * 9 + Math.sin(t * .7 + i) * .2, .2 + h(i, 2) * 3 + u * .8, -2.4 + h(i, 3) * 4.4] });
  cam1 = new CamPath([
    { t: 0, pos: [-2.6, 1.15, 5.2], look: [-1.6, 1.25, -1], fov: 42, creep: .16 },
    { t: 1.35, dur: 1.3, pos: [.1, 1.2, 4.3], look: [0, 1.2, -1], fov: 40, creep: .2 },
    { t: 2.5, dur: .5, pos: [.9, 1.0, 3.6], look: [.15, 1.15, -1], fov: 42, creep: .2 },
    { t: 3.45, dur: .6, pos: [-.5, 1.45, 4.2], look: [.15, 1.1, -1], fov: 40, creep: .2 },
    { t: 4.45, dur: .5, pos: [.2, 1.0, 3.9], look: [.35, 1.0, -1], fov: 42, creep: .22 },
    { t: 5.0, dur: .26, move: 'whip', pos: [200.2, 1.5, 6.6], look: [200, 1.75, -2], fov: 42, creep: .2 },
    { t: 6.3, dur: .45, pos: [201.5, 1.15, 4.0], look: [200.75, 1.15, -1], fov: 38, creep: .22 },
    { t: 7.5, dur: .4, pos: [200.9, 1.05, 4.2], look: [200.7, 1.2, -1], fov: 42, creep: .2 },
    { t: 8.5, dur: .55, pos: [198.9, 1.25, 4.9], look: [199.2, 1.45, -1], fov: 42, creep: .2 },
    { t: 9.6, dur: .7, pos: [200, 1.2, 5.6], look: [199.85, 1.7, -2], fov: 42, creep: .2 },
    { t: 10.0, dur: .24, move: 'whip', pos: [400, 1.5, 7.6], look: [400, 2.0, -4], fov: 46, creep: .2 },
    { t: 11.15, dur: .8, pos: [399.2, 1.15, 4.2], look: [400, 1.2, -1], fov: 40, creep: .2 },
    { t: 12.45, dur: .9, pos: [400.9, 1.1, 4.0], look: [400, 1.2, -1], fov: 40, creep: .2 },
    { t: 13.4, dur: .5, pos: [400, 1.2, 3.4], look: [400, 1.28, -1], fov: 40, creep: .42 },
  ], { fps: FPS, drift: .05 });
  for (const v of VUR) cam1.kick(v.t, .7 * v.g);
}
export function frame(t, ctx) {
  const { cam } = ctx; const c = cam1.apply(cam, t);
  const yer = cam.position.x < 100 ? 'zindan' : cam.position.x < 300 ? 'sur' : 'arena';
  for (const k in sets) { sets[k].g.visible = sets[k].L.visible = k === yer; }
  dyn.isik.visible = yer === 'zindan';
  for (const f of dyn.alev) { const q = 1 + .16 * Math.sin(t * 27 + f.s) * Math.sin(t * 15 + f.s * 2); f.a.scale.set(1 + .06 * Math.sin(t * 21 + f.s), q, 1); f.a.rotation.z = .1 * Math.sin(t * 8 + f.s); f.p.intensity = f.k * (.86 + .14 * q); f.h.material.opacity = .26 * q; }
  dyn.zincir.forEach((z, i) => { z.rotation.z = .05 * Math.sin(t * 2 + i * 2); });
  dyn.sancak.forEach((m, j) => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + .75) / 1.5; p.setZ(i, Math.sin(u * 6 - t * 7 + j) * .14 * u); } p.needsUpdate = true; });
  dyn.sancak2.forEach((m, j) => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const u = (1.8 - p.getY(i)) / 3.6; p.setZ(i, Math.sin(u * 4 - t * 4 + j) * .16 * u); } p.needsUpdate = true; });
  dyn.seyirci.forEach((m, i) => { m.position.y = 3.2 + i * 1.15 + Math.abs(Math.sin(t * 5 + i * 1.3)) * .1; });
  for (const k in kart) kart[k].gizle();
  const ot = oyun(t), ton = { zindan: [1, .96, .95], sur: [.93, .95, 1.04], arena: [1, 1, .97] }[yer];
  let zi = 0;
  for (const [k, keys] of Object.entries(K[yer])) {
    const d = durum(keys, yer === 'zindan' ? Math.min(t, 5) : yer === 'sur' ? Math.max(5, ot) : Math.max(10, t)); zi++;
    const ACIK = { zindan: { arin: -.1, m1: .32, m2: .32 }, sur: { arin: -.02, m1: .3, m2: -.35, kargan: .05 }, arena: { arin: -.22, sungur: .24 } };
    let x = d.x + (ACIK[yer][k] ?? 0), yere = d.poz === 'yerde' || d.poz === 'dus';
    if (yer === 'arena' && t > SON + .1) x += Math.sin(t * 34 + zi) * .008;                     // kilitlenen kılıçlar titrer
    const z = yere ? -.5 : k === 'arin' ? .04 : k === 'm2' ? -.12 : -.04;
    const ifade = yere ? 'uzgun' : k === 'arin' || k === 'kargan' ? 'kizgin' : d.poz === 'darbe' ? 'saskin' : 'kizgin';
    kart[k].koy(X[yer] + x, yere ? .16 : .075, z, cam, { t: yer === 'sur' ? ot : t, poz: d.poz, pozU: d.pozU, yon: d.yon, gecis: d.gecis, ifade, seed: zi * 3, esya: yere ? null : ESYA[k] }, ton);
  }
  // kıvılcım + parlama
  let flas = 0; dyn.yildiz.visible = false;
  VUR.forEach((v, i) => {
    const m = dyn.kiv[i], u = t - v.t; m.visible = v.set === yer && u >= 0 && u < .5; if (!m.visible) return;
    const p = m.geometry.attributes.position, R = rng(i * 77 + 5);
    for (let k = 0; k < p.count / 2; k++) { const a = R() * 6.28, s = (1.2 + R() * 3.6) * v.g, vx = Math.cos(a) * s, vy = Math.sin(a) * s * .8 + 1, vz = (R() - .2) * 2; const q = w => [v.x + vx * w, v.y + vy * w - 5 * w * w, .18 + vz * w]; p.setXYZ(k * 2, ...q(u)); p.setXYZ(k * 2 + 1, ...q(Math.max(0, u - .035))); }
    p.needsUpdate = true; m.material.opacity = 1 - u / .5;
    const f = Math.max(0, 1 - u / .16) * v.g; if (f > flas) { flas = f; dyn.flas.position.set(v.x, v.y, .8); dyn.yildiz.position.set(v.x, v.y, .3); }
  });
  dyn.flas.intensity = flas * (yer === 'arena' ? 1.6 : 3.2); if (flas > .02) { dyn.yildiz.visible = true; dyn.yildiz.scale.setScalar(.45 + flas * .35); dyn.yildiz.material.opacity = Math.min(.75, flas * .7); }
  dyn.toz.update(t); dyn.zer.update(t);
  const look = { focus: cam.position.z, coc: 4, range: 2.6, sat: { zindan: 1.02, sur: 1.15, arena: 1.05 }[yer], lift: { zindan: [.1, .085, .16], sur: [.095, .1, .18], arena: [.08, .075, .12] }[yer], bloom: .85, vignette: .26, captions: false };
  look.blur = c.moving > .15 ? 14 : 0; look.flash = flas > 1.1 ? .06 : 0;
  return look;
}
export function overlay(g, t, ctx) {
  const { W, H } = ctx, b = t < .3 ? 1 - t / .3 : t > 14.3 ? (t - 14.3) / .6 : 0;
  const s = t > YAV[0] && t < YAV[1] ? Math.min(1, (t - YAV[0]) / .12, (YAV[1] - t) / .12) : 0;       // yavaş çekimde sinema bantları
  if (s > 0) { g.fillStyle = '#0a0812'; g.fillRect(0, 0, W, H * .09 * s); g.fillRect(0, H - H * .09 * s, W, H * .09 * s); }
  if (b > 0) { g.fillStyle = `rgba(8,6,16,${Math.min(1, b)})`; g.fillRect(0, 0, W, H); }
}
export { kart, dyn, sets };
