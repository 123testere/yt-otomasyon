// Lamba Altında: Nur Bey'siz 3B masa (çizgi karakter üstüne çizilir). Kitap kapalı, lamba ışığı sahnede.
import * as Z from '/stories/nurbey-3b/story.js';
export const NAME = 'plaka-nur', FPS = 30, DUR = 1, setup = Z.setup;
export function frame(t, ctx) {
  const L = Z.frame(2.5, ctx), c = ctx.cam, dik = ctx.H > ctx.W; Z.nur.gizle(); Z.dyn.zer.pts.visible = false; Z.dyn.huz.visible = false; Z.dyn.hale.visible = false; ctx.scene.traverse(o => { if (o.isMesh && Math.abs(o.position.x + .86) < .005) o.visible = false; });
  if (dik) { c.position.set(.1, 1.35, 1.75); c.fov = 62; c.lookAt(.1, 1.3, -1); Z.dyn.kt.visible = false; }
  else { c.position.set(.15, 1.45, 1.75); c.fov = 44; c.lookAt(.15, 1.28, -1); Z.dyn.kt.position.x = .05; }
  Z.dyn.lamba.position.set(dik ? -.25 : -.45, 1.42, .4); Z.dyn.lamba.intensity = 3; Z.dyn.dolgu.position.x = -.4; Z.dyn.dolgu.intensity = 1.8; Z.dyn.hemi.intensity = 2.6;
  c.updateProjectionMatrix(); return { ...L, focus: 2, coc: 2, range: 1.2, vignette: .15 };
}
