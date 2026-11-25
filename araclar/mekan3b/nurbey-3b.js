// Lamba Altında — 3B örnek: Nur Bey gerçek bir masada. Zincir çekilir, ışık yanar, ansiklopedi açılır,
// kamera sayfaya süzülür ve mürekkep çizim (market arabası) kendi kendine çizilir. 13 sn, yatay, konuşmasız.
import * as THREE from 'three';
import { woodTex, stoneTex, wallTex, carpetTex, painted, flat, rng } from '/engine/src/paint.js';
import { CamPath, smoother } from '/engine/src/camera.js';
import { Smoke, beam, glow } from '/engine/src/fx.js';
import { Kart } from '/bizim/kart.js';
import { drawNurBey } from '/bizim/nurbey.js';
export const NAME = 'nurbey-3b', FPS = 30, DUR = 13, CUES = [];
const HDR = (r, g, b) => new THREE.Color().setRGB(r, g, b), cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), ramp = (t, a, b) => smoother((t - a) / (b - a));
const MASA = .8, YAN = 1.6, KX = .3, KZ = .16;         // masa yüksekliği, lambanın yandığı an, kitabın yeri
let nur, dyn = {}, cp;
function tuval(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { c, g, t }; }
function mesh(geo, mat, x, y, z, o = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.r) m.rotation.set(...o.r); if (mat.isMeshLambertMaterial) m.receiveShadow = true; if (!o.golgesiz && !/Plane/.test(geo.type)) m.castShadow = true; (o.g || dyn.scene).add(m); return m; }
const box = (a, b, c) => new THREE.BoxGeometry(a, b, c), cyl = (a, b, h, n = 24) => new THREE.CylinderGeometry(a, b, h, n);

// --- sayfa: krem kâğıt + kendi kendine çizilen titrek mürekkep
const PW = 1000, PH = 1300;
const CIZ = (() => {   // market arabası: çizgiler (sayfa pikseli)
  const L = []; const c = (...p) => L.push({ p }), amber = (...p) => L.push({ p, a: 1 });
  c([210, 470], [290, 470], [345, 860], [760, 860]); c([305, 545], [815, 545], [765, 775], [336, 775]);
  for (let k = 1; k < 7; k++) c([305 + 73 * k, 545], [336 + 61 * k, 775]); for (const y of [600, 655, 715]) c([305 + (y - 545) * .135, y], [815 - (y - 545) * .217, y]);
  const teker = x => { const p = []; for (let i = 0; i <= 26; i++) p.push([x + Math.cos(i / 26 * 6.283) * 44, 925 + Math.sin(i / 26 * 6.283) * 44]); return p; };
  L.push({ p: teker(395) }, { p: teker(715) }); amber([165, 470], [292, 470]);
  return L;
})();
function kagit(g, w, h) { g.fillStyle = '#f7ecd2'; g.fillRect(0, 0, w, h); const R = rng(6); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(170,130,70,${R() * .05})`; g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 26, 0, 7); g.fill(); } g.strokeStyle = 'rgba(120,80,40,.35)'; g.lineWidth = 4; g.strokeRect(48, 48, w - 96, h - 96); }
function sagSayfa(P, u, t) {
  const g = P.g; kagit(g, PW, PH);
  g.fillStyle = '#3a2416'; g.textAlign = 'center'; g.font = 'italic 40px Georgia'; g.globalAlpha = cl(u * 5); g.fillText('Bölüm I', PW / 2, 170); g.font = 'bold 78px Georgia'; g.fillText('Market Arabası', PW / 2, 262); g.fillStyle = '#d98f2a'; g.fillRect(PW / 2 - 130 * cl(u * 4), 296, 260 * cl(u * 4), 7); g.globalAlpha = 1;
  const top = CIZ.length, kare = Math.floor(t * 8); let uc = null;
  CIZ.forEach((s, i) => {
    const k = cl((u - .12) / .78 * (top + 2) - i, 0, 1); if (k <= 0) return;
    const R = rng(i * 91 + kare * 13 + 3), n = s.p.length - 1, son = n * k;
    g.strokeStyle = s.a ? '#e0962c' : '#150b08'; g.lineWidth = s.a ? 20 : 12; g.lineCap = g.lineJoin = 'round'; g.beginPath();
    for (let j = 0; j < n; j++) { if (son <= j) break; const q = Math.min(1, son - j), a = s.p[j], b = s.p[j + 1]; const ad = n > 8 ? 1 : 9; for (let m = j ? 1 : 0; m <= ad; m++) { const f = m / ad * q, x = a[0] + (b[0] - a[0]) * f + (R() - .5) * 4.5, y = a[1] + (b[1] - a[1]) * f + (R() - .5) * 4.5; if (!j && !m) g.moveTo(x, y); else g.lineTo(x, y); if (k < 1) uc = [x, y]; } }
    g.stroke();
  });
  const e = cl((u - .86) / .14); g.globalAlpha = e; g.fillStyle = '#3a2416'; g.font = 'italic 44px Georgia'; g.fillText('Oklahoma, 1937', PW / 2, 1095); g.globalAlpha = 1;
  P.t.needsUpdate = true; return uc;
}
export async function setup(ctx) {
  const { scene } = ctx; dyn.scene = scene; scene.background = new THREE.Color('#141228');
  // oda: duvar kâğıdı, kitaplık, pencere, halı
  mesh(new THREE.PlaneGeometry(9, 4), painted(stoneTex({ base: '#5b6490', bw: 256, bh: 128, rep: [3, 2] })), 0, 2, -1.75);
  mesh(new THREE.PlaneGeometry(9, 9), painted(woodTex({ base: '#6e4c38', rep: [3, 3] })), 0, 0, 0, { r: [-Math.PI / 2, 0, 0] });
  const ah = painted(woodTex({ base: '#70493a', rep: [1, 1] })), R = rng(12);
  const raf = (x0, w) => { mesh(box(w, 3.1, .06), flat('#3c2838'), x0, 1.55, -1.68); for (const s of [-1, 1]) mesh(box(.07, 3.1, .4), ah, x0 + s * w / 2, 1.55, -1.5);
    for (let k = 0; k < 7; k++) { const y = .05 + k * .47; mesh(box(w, .05, .4), ah, x0, y, -1.5); let x = x0 - w / 2 + .07; while (x < x0 + w / 2 - .1) { const bw = .035 + R() * .05, bh = .24 + R() * .13, renk = ['#8a3440', '#2f5a6e', '#c08a3a', '#4a6a48', '#5a3a66', '#d8c8a0', '#2c3a5e'][R() * 7 | 0]; if (R() > .1) { const b = mesh(box(bw, bh, .24), flat(renk), x + bw / 2, y + .025 + bh / 2, -1.45, { r: [0, 0, R() > .88 ? .12 : 0] }); mesh(box(bw + .002, .018, .243), flat('#e0b050'), x + bw / 2, y + bh * .8, -1.45, { golgesiz: true, r: [0, 0, b.rotation.z] }); } x += bw + .006; } } };
  raf(-1.75, 1.7); raf(1.95, 1.3);
  // pencere: gece ve ay
  const gece = tuval(512, 640, (g, w, h) => { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#2a3a8c'); q.addColorStop(1, '#8a90d8'); g.fillStyle = q; g.fillRect(0, 0, w, h); const r = rng(5); g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(r() * w, r() * h * .7, 1 + r() * 2, 0, 7); g.fill(); } g.fillStyle = '#3c4488'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 12) g.lineTo(x, h * .8 - Math.abs(Math.sin(x * .02)) * 50 - (x % 120 < 18 ? 90 : 0)); g.lineTo(w, h); g.fill(); });
  mesh(new THREE.PlaneGeometry(1.2, 1.5), new THREE.MeshBasicMaterial({ map: gece.t }), .45, 1.95, -1.72);
  const ay = mesh(new THREE.CircleGeometry(.12, 32), new THREE.MeshBasicMaterial({ color: HDR(1.8, 1.8, 1.9) }), .75, 2.4, -1.71);
  const cer = flat('#8a6248'); for (const x of [-.15, .45, 1.05]) mesh(box(.07, 1.62, .1), cer, x, 1.95, -1.67); for (const y of [1.17, 1.95, 2.73]) mesh(box(1.3, .07, .1), cer, .45, y, -1.67); mesh(box(1.45, .06, .24), cer, .45, 1.13, -1.62);
  for (const s of [-1, 1]) { const p = new THREE.PlaneGeometry(.42, 1.95, 14, 1); const a = p.attributes.position; for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(a.getX(i) * 34) * .04); p.computeVertexNormals(); mesh(p, flat('#8c2f42', { side: THREE.DoubleSide }), .45 + s * .82, 1.95, -1.52); }
  // masa
  const ms = painted(woodTex({ base: '#9a8468', plank: 128, rep: [2, 1] }));
  mesh(box(2.2, .07, 1.05), ms, .05, MASA - .035, 0); mesh(box(2.1, .16, .95), ah, .05, MASA - .15, 0); for (const x of [-.95, 1.05]) for (const z of [-.42, .42]) mesh(box(.08, .7, .08), ah, x, .35, z);
  // üst eşyaları: kitap yığını, hokka ve tüy kalem, gözlük, saat
  [['#2f5a6e', .34, .05, .26], ['#8a3440', .3, .06, .23], ['#c08a3a', .27, .045, .2]].reduce((y, [r, w, h, d], i) => { mesh(box(w, h, d), flat(r), .86, y + h / 2, -.2, { r: [0, .25 - i * .3, 0] }); mesh(box(w - .02, h - .018, d + .002), flat('#efe4c8'), .865, y + h / 2, -.2, { r: [0, .25 - i * .3, 0], golgesiz: true }); return y + h; }, MASA);
  mesh(cyl(.045, .055, .07), flat('#27304e'), .74, MASA + .035, .24); mesh(cyl(.022, .022, .02), flat('#d9a441'), .74, MASA + .08, .24);
  const tuy = tuval(96, 384, (g, w, h) => { g.fillStyle = '#f2eee6'; g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(-10, h * .5, w * .5, 4); g.quadraticCurveTo(w + 12, h * .5, w / 2, h); g.fill(); g.strokeStyle = '#8a7a6a'; g.lineWidth = 5; g.stroke(); g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 20); g.stroke(); });
  const tm = mesh(new THREE.PlaneGeometry(.08, .32), new THREE.MeshLambertMaterial({ map: tuy.t, transparent: true, alphaTest: .4, side: THREE.DoubleSide }), .79, MASA + .23, .23, { r: [0, 0, -.3] }); tm.castShadow = true;
  const sc = mesh(cyl(.085, .085, .05, 32), flat('#d9a441'), -.86, MASA + .1, -.1, { r: [Math.PI / 2, 0, 0] });
  const sy = tuval(256, 256, (g, w) => { g.fillStyle = '#f7ecd2'; g.fillRect(0, 0, w, w); g.strokeStyle = '#2a1a12'; g.lineWidth = 9; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke(); } g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 48); g.moveTo(128, 128); g.lineTo(176, 152); g.stroke(); });
  mesh(new THREE.CircleGeometry(.072, 32), painted(sy.t), -.86, MASA + .1, -.072);
  // ansiklopedi (3B): kapak, sayfa bloğu, dönen sayfalar
  const kt = dyn.kt = new THREE.Group(); kt.position.set(KX, MASA + .004, KZ); kt.rotation.y = -.04; scene.add(kt);
  const SW = .27, SH = .35, kap = flat('#7a2f36'), blok = flat('#efe2c2');
  mesh(box(SW + .02, .012, SH + .02), kap, SW / 2, .006, 0, { g: kt }); mesh(box(SW, .022, SH), blok, SW / 2, .023, 0, { g: kt });
  dyn.sag = tuval(PW, PH, (g, w, h) => kagit(g, w, h));
  const sm = mesh(new THREE.PlaneGeometry(SW, SH), painted(dyn.sag.t, { color: '#fff6dc' }), SW / 2, .0346, 0, { g: kt, r: [-Math.PI / 2, 0, 0] });
  const solT = tuval(PW, PH, (g, w, h) => { kagit(g, w, h); g.fillStyle = '#3a2416'; g.textAlign = 'center'; g.font = 'bold 66px Georgia'; g.fillText('EŞYALARIN', w / 2, 250); g.fillText('ANSİKLOPEDİSİ', w / 2, 332); g.strokeStyle = '#3a2416'; g.lineWidth = 6; const r = rng(9); for (let y = 440; y < 1160; y += 44) { g.globalAlpha = .55; g.beginPath(); g.moveTo(130, y); const s = y % 264 < 44 ? .5 : 1; for (let x = 130; x < 130 + 740 * s; x += 22) g.lineTo(x, y + (r() - .5) * 8); g.stroke(); } g.globalAlpha = 1; });
  const kapT = tuval(700, 900, (g, w, h) => { g.fillStyle = '#7a2f36'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e0aa3e'; g.lineWidth = 14; g.strokeRect(44, 44, w - 88, h - 88); g.lineWidth = 5; g.strokeRect(70, 70, w - 140, h - 140); g.fillStyle = '#e0aa3e'; g.textAlign = 'center'; g.font = 'bold 72px Georgia'; g.fillText('EŞYALARIN', w / 2, 360); g.fillText('ANSİKLOPEDİSİ', w / 2, 450); g.beginPath(); g.arc(w / 2, 610, 60, 0, 7); g.lineWidth = 10; g.stroke(); });
  // kapak (sol): menteşe x=0'da; kapalıyken sağın üstünde
  const pv = dyn.kapak = new THREE.Group(); pv.position.y = .036; kt.add(pv);
  mesh(box(SW + .02, .01, SH + .02), kap, SW / 2, .012, 0, { g: pv }); mesh(new THREE.PlaneGeometry(SW + .02, SH + .02), painted(kapT.t), SW / 2, .0178, 0, { g: pv, r: [-Math.PI / 2, 0, 0] });
  mesh(box(SW, .012, SH), blok, SW / 2, 0, 0, { g: pv }); const ic = mesh(new THREE.PlaneGeometry(SW, SH), painted(solT.t), SW / 2, -.0066, 0, { g: pv, r: [Math.PI / 2, 0, 0] }); ic.rotation.set(Math.PI / 2, 0, 0); solT.t.wrapS = THREE.RepeatWrapping; solT.t.repeat.x = 1;
  ic.rotation.z = Math.PI; ic.material.side = THREE.DoubleSide;
  dyn.yaprak = [0, 1, 2].map(i => { const p = new THREE.Group(); p.position.y = .0352 + i * .0004; kt.add(p); const geo = new THREE.PlaneGeometry(SW, SH, 12, 1); geo.rotateX(-Math.PI / 2); geo.translate(SW / 2, 0, 0); const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, 1 - uv.getX(j)); const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: solT.t, side: THREE.DoubleSide, color: '#e6dfd2' })); m.castShadow = m.receiveShadow = true; p.add(m); return { p, geo, baz: geo.attributes.position.array.slice() }; });
  // Nur Bey: 520 birim = 56 cm
  nur = new Kart(scene, { w: 1100, h: 1200, ox: 550, oy: 1130, metre: .56 / 520 / 1.9, golge: false, ciz: (g, x, y, o) => drawNurBey(g, { ...o, x, y, s: 1.9, koni: false }) });
  nur.isikli = true;
  // ışık: Nur Bey'in ampulü asıl ışık; ay soğuk dolgu
  dyn.hemi = new THREE.HemisphereLight('#7c8cf0', '#42365e', .9); scene.add(dyn.hemi);
  const l = dyn.lamba = new THREE.SpotLight('#ffe0a4', 0, 5, 1.0, .8, .9); l.position.set(-.12, MASA + .66, .3); l.target.position.set(KX - .06, MASA, KZ); l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.camera.near = .05; l.shadow.camera.far = 4; l.shadow.bias = -.0005; l.shadow.normalBias = .006; l.shadow.radius = 4; scene.add(l, l.target);
  dyn.dolgu = new THREE.PointLight('#ffcc8c', 0, 4, 1.3); dyn.dolgu.position.set(-.3, MASA + .5, .35); scene.add(dyn.dolgu);
  const ayl = new THREE.SpotLight('#9db4ff', 1.5, 0, .5, .4, 0); ayl.position.set(1.8, 3.6, -5); ayl.target.position.set(-.1, .8, .2); scene.add(ayl, ayl.target);
  dyn.huz = beam(scene, [-.24, MASA + .46, .15], [KX, MASA + .02, KZ], { r0: .07, r1: .4, color: '#ffc878', strength: 0 });
  dyn.ayh = beam(scene, [.6, 2.3, -1.6], [-.5, .75, .5], { r0: .3, r1: .7, color: '#a9bcff', strength: .1 });
  dyn.hale = glow(scene, [-.33, MASA + .38, .06], '#ffb050', 1.1, 0);
  dyn.zer = new Smoke(scene, { color: '#ffe0a8', maxPoints: 300, H: ctx.H, additive: true, near: .2 });
  const h = (i, k) => { const x = Math.sin(i * 12.99 + k * 78.2) * 43758.5; return x - Math.floor(x); };
  dyn.zer.wisps.push({ n: 130, size: .006, alpha: .55, speed: .05, on: t => t > YAN, path: (u, t, i) => [-.2 + (h(i, 1) - .3) * 1.1 + Math.sin(t * .6 + i) * .03, MASA + .03 + h(i, 2) * .5 + u * .12, -.1 + h(i, 3) * .6] });
  cp = new CamPath([
    { t: 0, pos: [.55, 1.42, 2.15], look: [.12, 1.12, -.3], fov: 40, creep: .14 },
    { t: 3.3, dur: 1.6, pos: [.18, 1.28, 1.42], look: [.0, 1.04, 0], fov: 40, creep: .16 },
    { t: 5.6, dur: 1.4, pos: [.2, 1.36, .98], look: [.16, .92, .08], fov: 40, creep: .14 },
    { t: 7.9, dur: 2.0, pos: [KX + .13, 1.36, KZ + .24], look: [KX + .13, MASA + .03, KZ + .012], fov: 40, creep: .14 },
    { t: 12.4, dur: 1.7, pos: [.3, 1.34, 1.35], look: [.0, 1.02, 0], fov: 40, creep: .14 },
  ], { fps: FPS, drift: .012 });
}
export function frame(t, ctx) {
  const { cam } = ctx; cp.apply(cam, t);
  const a = drawNurBey.acilis(t, YAN - .5), acik = ramp(t, 2.9, 4.2), ciz = cl((t - 6.9) / 4);
  const yon = t > 11.4;
  const ifade = t < YAN - .5 ? 'merakli' : t < 3 ? 'saskin' : t < 5 ? 'gulumsuyor' : t < 11 ? 'anlatiyor' : 'gururlu';
  nur.koy(-.36, MASA, -.06, cam, { t, ifade, poz: t > 5.4 && t < 10.6 ? 'egil' : 'dik', yon: 1, isik: a.isik, zincir: a.zincir, bak: .6 }, t < YAN ? [.72, .74, .95] : [1, 1, 1]);
  const I = cl((a.isik - .12) / .88) * (1 + .015 * Math.sin(t * 23));
  dyn.lamba.intensity = 2.5 * I; dyn.dolgu.intensity = 1.5 * I; dyn.hemi.intensity = 1.9 + .5 * I; dyn.hemi.color.set('#7c8cf0').lerp(dyn.sicak ||= new THREE.Color('#c8b8d8'), I * .8); dyn.hale.material.opacity = .34 * I; dyn.huz.material.uniforms.uStrength.value = .34 * I * (1 - .75 * ramp(t, 6.4, 7.6) * (1 - ramp(t, 10.9, 12))); dyn.huz.material.uniforms.uT.value = t; dyn.ayh.material.uniforms.uT.value = t;
  dyn.kapak.rotation.z = acik * (Math.PI - .02);
  dyn.yaprak.forEach((y, i) => { const u = ramp(t, 3.5 + i * .55, 4.5 + i * .55); y.p.rotation.z = u * (Math.PI - .035 - i * .006); y.p.position.y = .0352 + i * .0004 + (u > .5 ? .012 : 0); y.p.visible = t > 3.2; const pa = y.geo.attributes.position, b = y.baz, k = Math.sin(u * Math.PI) * .05; for (let j = 0; j < pa.count; j++) pa.setY(j, b[j * 3 + 1] + Math.sin(b[j * 3] / .27 * Math.PI) * k); pa.needsUpdate = true; y.geo.computeVertexNormals(); });
  if (t > 5) sagSayfa(dyn.sag, ciz, t);
  dyn.zer.update(t);
  const yakin = ramp(t, 6.2, 7.6) * (1 - ramp(t, 10.9, 12));
  return { focus: yakin > .5 ? cam.position.distanceTo(new THREE.Vector3(KX + .13, MASA, KZ)) : cam.position.distanceTo(new THREE.Vector3(-.2, 1.05, 0)), coc: 5 * (1 - yakin * .7), range: .8, sat: 1.08, lift: [.085, .075, .13], bloom: .55, vignette: .28, captions: false };
}
export function overlay(g, t, ctx) { const b = t < .4 ? 1 - t / .4 : t > 12.5 ? (t - 12.5) / .45 : 0; if (b > 0) { g.fillStyle = `rgba(10,8,18,${Math.min(1, b)})`; g.fillRect(0, 0, ctx.W, ctx.H); } }
export { nur, dyn };
