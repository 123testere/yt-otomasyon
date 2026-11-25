// Hazır 3B mekân görüntüleri (karaktersiz). t = 0 zindan, 1 sur, 2 arena
import * as Z from '/stories/zincirli-3b/story.js';
export const NAME = 'plaka', FPS = 30, DUR = 3;
export const setup = Z.setup;
const AN = [3.2, 9.4, 10.6], X = [0, 200, 400];
export function frame(t, ctx) {
  const i = Math.round(t), L = Z.frame(AN[i], ctx), c = ctx.cam, dik = ctx.H > ctx.W;
  for (const k in Z.kart) Z.kart[k].gizle();
  Z.dyn.toz.pts.visible = Z.dyn.zer.pts.visible = Z.dyn.yildiz.visible = false; Z.dyn.flas.intensity = 0; Z.dyn.kiv.forEach(m => { m.visible = false; });
  c.position.set(X[i], 1.5, dik ? 6.4 : 5.2); c.fov = dik ? 62 : 46; c.lookAt(X[i], dik ? 1.95 : 1.72, -2); c.updateProjectionMatrix();
  return { ...L, focus: 8, coc: 0, range: 30, blur: 0, flash: 0, vignette: .05, bloom: .7 };
}
