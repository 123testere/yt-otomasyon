// 3B görünüm katmanı (kullanıcı kararı 2026-11-25: bütün dizi videoları). Arka plan ve karakterler ayrı katmanda çizilir;
// burada kamera derinliği, yere/duvara düşen karakter gölgesi, sahne ışığı, parıltı ve tozla birleştirilir.
// Yalnız Canvas 2D: GitHub'da ekran kartı gerekmez. Hazır 3B mekân görüntüleri: remotion/public/mekan3b/<ad>-<y|d>.jpg
export const PLAKALAR = ['zindan', 'arena', 'sur'];
// Sahnede açılan kapı, gizli geçit ya da zemin kapağı varsa mekânın kodla çizilen hâli gerekir
export const plakaAdi = (sc) => (PLAKALAR.includes(sc.mekan) && !sc.gecit && !sc.kapi && !sc.yerKapak ? sc.mekan : null);

// Ana ışık (sıcak/soğuk), karşı ton, ışığın yönü (-1 sol, 1 sağ), gölge koyuluğu, titreme (ateş)
const ISIK = {
  ates: { ana: '255,170,90', karsi: '70,80,200', yon: -1, golge: 0.42, kuvvet: 0.3, titre: 1 },
  gece: { ana: '150,175,255', karsi: '255,160,90', yon: 1, golge: 0.4, kuvvet: 0.24, titre: 0 },
  gunes: { ana: '255,222,150', karsi: '110,140,230', yon: 1, golge: 0.34, kuvvet: 0.2, titre: 0 },
  oda: { ana: '255,206,150', karsi: '90,110,220', yon: -1, golge: 0.3, kuvvet: 0.2, titre: 0 },
  ekran: { ana: '120,170,255', karsi: '190,90,255', yon: 1, golge: 0.28, kuvvet: 0.14, titre: 0 },
};
const MEKAN_ISIK = {
  zindan: 'ates', mahzen: 'ates', merdiven: 'ates', kanal: 'gece', sur: 'gece', 'koy-yangin': 'ates', loca: 'ates',
  arena: 'gunes', avlu: 'gunes', 'koy-gunduz': 'gunes', kervan: 'gunes', 'tas-ocagi': 'gunes',
};
// Arkasında duvar olmayan açık yerler: duvar gölgesi düşmez
export const ACIK_HAVA = ['koy-gunduz', 'koy-yangin', 'kervan', 'tas-ocagi', 'loca', 'fuar', 'meydan', 'kuyu', 'orman', 'yol', 'kanal', 'merdiven', 'gelecek'];
export function isikSec(sc, grup) {
  if (MEKAN_ISIK[sc.mekan]) return ISIK[MEKAN_ISIK[sc.mekan]];
  if (grup === 'tekno') return ISIK.ekran;
  if (grup === 'oyun') return ISIK.oda;
  return sc.zaman === 'gunduz' || sc.zaman === 'sabah' ? ISIK.gunes : sc.zaman ? ISIK.gece : ISIK.oda;
}
const yumusat = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const rast = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

// yeniTuval(w,h): tuval üretir. Döner: { on, arka, g } bağlamları; birlestir(...) ana tuvale yazar.
export function ucBoyut(yeniTuval, W, H) {
  const [sw, sh, pw, ph] = [Math.round(W / 4), Math.round(H / 4), Math.round(W / 8), Math.round(H / 8)];
  const T = { arka: yeniTuval(W, H), on: yeniTuval(W, H), sil: yeniTuval(sw, sh), par: yeniTuval(pw, ph), yari: yeniTuval(W >> 1, H >> 1) };
  const C = Object.fromEntries(Object.entries(T).map(([k, c]) => [k, c.getContext('2d')]));
  const temizle = (c, w, h) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, w, h); };
  return {
    arka: C.arka, on: C.on,
    temizle() { temizle(C.arka, W, H); temizle(C.on, W, H); },
    // ok: { t, u, d (sahne süresi), no (sahne sırası), yer (ayak hizası), isik, net (yazılı ekran: bulanıklık/kamera yok), odak (konuşanın x'i) }
    birlestir(ctx, { t, u, d, no, yer, kamYer = yer, isik: L, net, odak, duvar = true }) {
      const titre = L.titre ? 1 + 0.1 * Math.sin(t * 21) * Math.sin(t * 13.3) : 1;
      const yol = yumusat(u / Math.max(2, d));
      const z = net ? 1 : 1.025 + 0.045 * yol;                              // kamera hiç durmaz: yavaş itme
      const kay = net ? 0 : (no % 2 ? -1 : 1) * W * 0.008 * (yol - 0.5) * 2;   // yana süzülme
      const ox = W * (0.5 + ((odak ?? W / 2) / W - 0.5) * 0.35);
      const kam = (k) => { const s = 1 + (z - 1) * k; ctx.translate(ox + kay * k, kamYer); ctx.scale(s, s); ctx.translate(-ox, -kamYer); };
      // ışıklı kenar: karakterin ışığa bakan yanı aydınlanır, öbür yanı soğur
      const on = C.on;
      on.setTransform(1, 0, 0, 1, 0, 0); on.globalCompositeOperation = 'source-atop'; on.globalAlpha = 1;
      const g1 = on.createLinearGradient(L.yon < 0 ? 0 : W, 0, L.yon < 0 ? W : 0, H * 0.35);
      g1.addColorStop(0, `rgba(${L.ana},${0.26 * titre})`); g1.addColorStop(0.5, `rgba(${L.ana},.05)`); g1.addColorStop(1, `rgba(${L.karsi},.22)`);
      on.fillStyle = g1; on.fillRect(0, 0, W, H); on.globalCompositeOperation = 'source-over';
      // silüet (gölgeler bundan)
      const s = C.sil; temizle(s, sw, sh); s.drawImage(T.on, 0, 0, sw, sh); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#160f26'; s.fillRect(0, 0, sw, sh); s.globalCompositeOperation = 'source-over';
      ctx.save(); kam(0.55);
      ctx.drawImage(T.arka, 0, 0);
      if (!net) { C.yari.imageSmoothingQuality = 'high'; C.yari.drawImage(T.arka, 0, 0, W >> 1, H >> 1); C.sil.imageSmoothingEnabled = true; ctx.globalAlpha = 0.45; ctx.drawImage(T.yari, 0, 0, W, H); ctx.globalAlpha = 1; }
      // arka plana derinlik: köşeler koyulaşır, ana ışık kaynağından sıcak/soğuk hale
      const r = ctx.createRadialGradient(W * (0.5 + L.yon * 0.22), H * 0.3, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.72);
      ctx.globalCompositeOperation = 'soft-light'; r.addColorStop(0, `rgba(${L.ana},${L.kuvvet * 1.5 * titre})`); r.addColorStop(0.55, `rgba(${L.ana},0)`); r.addColorStop(1, 'rgba(8,6,26,.75)');
      ctx.fillStyle = r; ctx.fillRect(-W * 0.1, -H * 0.1, W * 1.2, H * 1.2); ctx.globalCompositeOperation = 'source-over';
      if (!net) {
        // duvar gölgesi (ışığın tersine kayar, zemine taşmaz)
        ctx.save(); ctx.beginPath(); ctx.rect(-W * 0.1, -H * 0.1, W * 1.2, yer - H * 0.07); ctx.clip(); ctx.globalAlpha = duvar ? L.golge * 0.42 : 0;
        ctx.translate(-L.yon * W * 0.035, -H * 0.02); ctx.drawImage(T.sil, 0, 0, W, H); ctx.restore();
        // yer gölgesi: ayak hizasından aşağı, ışığın tersine yatan silüet
        ctx.save(); ctx.beginPath(); ctx.rect(-W * 0.1, yer - H * 0.012, W * 1.2, H); ctx.clip(); ctx.globalAlpha = L.golge;
        ctx.transform(1, 0, -L.yon * -0.5, -0.26, 0, yer * 1.26); ctx.translate(-L.yon * 0.5 * yer, 0); ctx.drawImage(T.sil, 0, 0, W, H); ctx.restore();
      }
      ctx.restore();
      ctx.save(); kam(1); ctx.drawImage(T.on, 0, 0); ctx.restore();
      // parıltı: yalnız çok parlak yerler (alev, kıvılcım, ay) yayılır
      const p = C.par; temizle(p, pw, ph); p.drawImage(ctx.canvas, 0, 0, pw, ph); p.globalCompositeOperation = 'multiply';
      for (let k = 0; k < 2; k++) p.drawImage(T.par, 0, 0); p.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = net ? 0.1 : 0.24; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(T.par, 0, 0, W, H); ctx.restore();
      if (net) return;
      // ışıkta uçuşan toz
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) { const f = (t * (0.02 + rast(i, 3) * 0.03) + rast(i, 4)) % 1, x = (rast(i, 1) + Math.sin(t * 0.3 + i) * 0.012) * W, y = (rast(i, 2) - f * 0.22 + 1) % 1 * H * 0.9, b = (1 + rast(i, 5) * 2.4) * (Math.min(W, H) / 1080); ctx.fillStyle = `rgba(${L.ana},${0.4 * Math.sin(f * Math.PI)})`; ctx.beginPath(); ctx.arc(x, y, b, 0, 6.3); ctx.fill(); }
      ctx.restore();
      const v = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      v.addColorStop(0, 'rgba(6,4,18,0)'); v.addColorStop(1, 'rgba(6,4,18,.42)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },
  };
}
// Hazır mekân: meşale alevleri titreşir (görüntüdeki yerler, 0-1)
const ALEV = { 'zindan-y': [[0.332, 0.37], [0.668, 0.37]], 'sur-y': [[0.25, 0.43], [0.773, 0.43]] };
export function plakaCiz(ctx, ad, img, W, H, t) {
  ctx.drawImage(img, 0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  (ALEV[`${ad}-${W > H ? 'y' : 'd'}`] ?? []).forEach(([x, y], i) => {
    const a = 0.2 + 0.13 * Math.sin(t * 19 + i * 2) * Math.sin(t * 11.7 + i), g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, H * 0.24);
    g.addColorStop(0, `rgba(255,170,70,${a})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(x * W - H * 0.25, y * H - H * 0.25, H * 0.5, H * 0.5);
  });
  ctx.restore();
}
