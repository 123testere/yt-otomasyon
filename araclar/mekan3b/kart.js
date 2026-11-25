// Kendi 2B karakterlerimizi (çöp adam, Nur Bey) 3B dünyada kart olarak gösterir; gerçek gölge düşürür.
import * as THREE from 'three';
export class Kart {
  // w,h: tuval (çizim birimi), ox,oy: ayak/taban noktası, metre: 1 çizim biriminin dünyadaki boyu
  constructor(scene, { w, h, ox, oy, metre, ciz, golge = true }) {
    Object.assign(this, { w, h, ox, oy, metre, ciz });
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(w * metre, h * metre); geo.translate((w / 2 - ox) * metre, (oy - h / 2) * metre, 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: true, alphaTest: .02, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.layers.set(1); scene.add(this.mesh);
    this.caster = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: .5, colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    this.caster.castShadow = golge; this.caster.userData.shadowOnly = true; (scene.userData.shadowOnly ||= []).push(this.caster); scene.add(this.caster);
  }
  gizle() { this.mesh.visible = this.caster.visible = false; }
  koy(x, y, z, cam, o, ton = [1, 1, 1]) {
    this.mesh.visible = this.caster.visible = true;
    this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.clearRect(0, 0, this.w, this.h);
    this.ciz(this.g, this.ox, this.oy, o); this.tex.needsUpdate = true;
    const r = Math.atan2(cam.position.x - x, cam.position.z - z) * .35;   // tam dönmez: dövüşçüler aynı düzlemde kalır
    for (const m of [this.mesh, this.caster]) { m.position.set(x, y, z); m.rotation.set(0, r, 0); }
    this.mat.color.setRGB(...ton);
  }
}
