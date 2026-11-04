// Kaynak: Claude Youtube/kanal/lamba-altinda/nurbey.js — değiştirmeden kopyalandı (tek kaynak kuralı).
/* =====================================================================
   NUR BEY — Lamba Altında kanalının karakteri
   Tek kaynak: her videoda Nur Bey SADECE bu fonksiyonla çizilir.
   Oranları, renkleri, yüz yerleşimini değiştirme; yeni ifade/poz eklenir.

   drawNurBey(ctx, {
     x, y,            // tabanın orta-alt noktası (dünya koordinatı)
     s: 1,            // ölçek (1 = 520 birim boy)
     t: 0,            // zaman (sn) — titreme, nefes, göz kırpma
     ifade: 'anlatiyor', // anlatiyor | merakli | saskin | gulumsuyor | kahkaha | dusunceli | endiseli | gururlu
     poz: 'dik',      // dik | egil | isaret | kutlama
     yon: 1,          // 1 sağa bakar, -1 sola (aynalama)
     konusuyor: false,// true: ağız konuşur
     agiz: null,      // 0..1 ağız açıklığı (ses analizinden); null ise otomatik
     vizem: 'A',      // A | E | O | U | M
     bak: 0,          // -1..1 gözbebeği yönü (yatay)
     isik: 0.7,       // 0..1 ampul parlaklığı
     koni: true,      // ışık konisi çizilsin mi
     kitap: null,     // null = ansiklopedi yok · 0 = kapalı · 1 = tam açık
     zincir: 0        // 0..1 zincir çekilme miktarı
   })

   İMZA ANI — "Lambayı yakalım / hadi konuya geçelim":
     const a = drawNurBey.acilis(t, tBasla);   // {zincir, isik, kitap, ifade}
     drawNurBey(ctx, {...o, ...a});
   0.0–0.5 sn zincir çekilir · 0.5–1.1 sn ışık titreyerek yanar · 0.9–2.1 sn ansiklopedi açılır
   ===================================================================== */
(function (root) {
  const P = {
    kagit:'#F3EAD7', murekkep:'#2B2A33', bordo:'#7A2E24', bordoKoyu:'#5E211A',
    pirinc:'#B8893B', pirincAcik:'#D4A858', lamba:'#E8A33D', ampul:'#FFE2A6', agizIc:'#3A1712'
  };

  // ---------- deterministik titreme ----------
  const h = n => { n = Math.sin(n * 127.1) * 43758.5453; return n - Math.floor(n); };
  const boil = t => Math.floor(t * 6);                 // saniyede 6 "kaynama"
  const wob = (i, t, a) => (h(i * 13.7 + boil(t) * 7.3) - .5) * 2 * a;

  function ink(ctx, pts, t, o = {}) {
    const { close = false, fill = null, w = 3.4, color = P.murekkep, seed = 0, amp = 1.4 } = o;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] + wob(i + seed, t, amp), y = p[1] + wob(i + seed + 91, t, amp);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (w > 0) { ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  const ell = (cx, cy, rx, ry, n = 32, a0 = 0, a1 = Math.PI * 2) => {
    const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
  };

  // ---------- POZLAR (tabana göre, birim koordinat; y yukarı negatif) ----------
  const POZ = {
    dik:     { dirsek: [-72, -235], bas: [28, -405],  egim: 0.14 },
    egil:    { dirsek: [-112, -205], bas: [70, -335], egim: 0.42 },
    isaret:  { dirsek: [-40, -245], bas: [96, -372],  egim: 0.62 },
    kutlama: { dirsek: [-28, -290], bas: [8, -478],   egim: -0.10 }
  };

  // ---------- İFADELER ----------
  // kas: [solKaldır, sağKaldır], egik: kaşın iç ucu yukarı(+) / aşağı(-)
  // goz: açıklık 0..1.3 · gozTip: 'nokta' | 'mutlu' | 'kirp' (sol kapalı)
  const IFADE = {
    anlatiyor:  { kas: [0, 0],    egik: 0.15, goz: 1,    gozTip: 'nokta', agiz: 'gulumseHafif' },
    merakli:    { kas: [2, -14],  egik: 0,    goz: 1.05, gozTip: 'nokta', agiz: 'yamuk', bak: .35 },
    saskin:     { kas: [-16, -16],egik: 0.2,  goz: 1.35, gozTip: 'nokta', agiz: 'O', isik: 1 },
    gulumsuyor: { kas: [-3, -3],  egik: 0.2,  goz: .7,   gozTip: 'nokta', agiz: 'gulumse' },
    kahkaha:    { kas: [-10, -10],egik: 0.25, goz: 1,    gozTip: 'mutlu', agiz: 'kahkaha', isik: 1 },
    dusunceli:  { kas: [-6, 4],   egik: -0.1, goz: .55,  gozTip: 'nokta', agiz: 'duz', bak: -.6, bakY: -.5 },
    endiseli:   { kas: [-6, -6],  egik: 0.9,  goz: .95,  gozTip: 'nokta', agiz: 'dalgali', isik: .45 },
    gururlu:    { kas: [-4, -12], egik: 0.1,  goz: 1,    gozTip: 'kirp',  agiz: 'gulumse' }
  };

  // ---------- parçalar ----------
  function kas(ctx, x, y, t, taraf, kaldir, egik, seed) {
    const ic = -egik * 8;   // iç uç (yüz merkezine yakın)
    const pIc = [x - taraf * 14, y + kaldir + ic], pDis = [x + taraf * 14, y + kaldir - ic * 0.3];
    ink(ctx, [pIc, [x, y + kaldir - 2], pDis], t, { w: 4.2, seed });
  }
  function goz(ctx, x, y, t, f, bak, bakY, kapali, seed) {
    if (kapali === 'mutlu') { ink(ctx, ell(x, y + 4, 11, 9, 10, Math.PI, Math.PI * 2), t, { w: 4, seed }); return; }
    if (kapali === 'kapali') { ink(ctx, ell(x, y - 2, 11, 7, 10, 0, Math.PI), t, { w: 4, seed }); return; }
    const r = 10.5 * f;
    ink(ctx, ell(x, y, r * 1.25, r * 1.35, 20), t, { close: true, fill: P.kagit, w: 2.6, seed });
    const px = x + bak * r * 0.45, py = y + (bakY || 0) * r * 0.4 + 1;
    ctx.beginPath(); ctx.arc(px, py, r * 0.62, 0, Math.PI * 2); ctx.fillStyle = P.murekkep; ctx.fill();
    ctx.beginPath(); ctx.arc(px + r * .22, py - r * .25, r * .2, 0, Math.PI * 2); ctx.fillStyle = P.kagit; ctx.fill();
    if (f < 0.95) { // üst göz kapağı (şapka renginde)
      const lid = (1 - f) * r * 2.2;
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * 1.4, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = P.bordo; ctx.fillRect(x - r * 1.5, y - r * 1.5, r * 3, lid); ctx.restore();
      ink(ctx, [[x - r * 1.25, y - r * 1.4 + lid], [x + r * 1.25, y - r * 1.4 + lid]], t, { w: 3, seed: seed + 3 });
    }
  }
  const VIZEM = { A: [1, 1], E: [1.25, .55], O: [.62, .95], U: [.45, .55], M: [1, 0] };
  function agiz(ctx, x, y, t, tip, acik, vizem, seed) {
    if (acik != null && acik > 0.06 && vizem !== 'M') {
      const [kw, kh] = VIZEM[vizem] || VIZEM.A;
      const w = 15 * kw + acik * 4, hh = 3 + acik * 15 * kh;
      ink(ctx, ell(x, y, w, hh, 18), t, { close: true, fill: P.agizIc, w: 3, seed });
      if (hh > 9) { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, w, hh, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#B5432F'; ctx.beginPath(); ctx.ellipse(x, y + hh * .8, w * .6, hh * .45, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      return;
    }
    switch (tip) {
      case 'gulumse': ink(ctx, ell(x, y - 6, 20, 13, 14, .18 * Math.PI, .82 * Math.PI), t, { w: 4, seed }); break;
      case 'gulumseHafif': ink(ctx, ell(x, y - 8, 15, 9, 12, .22 * Math.PI, .78 * Math.PI), t, { w: 4, seed }); break;
      case 'kahkaha':
        ink(ctx, [...ell(x, y - 2, 24, 22, 18, 0, Math.PI)], t, { close: true, fill: P.agizIc, w: 3.4, seed });
        ctx.save(); ctx.fillStyle = '#B5432F'; ctx.beginPath(); ctx.ellipse(x, y + 13, 11, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); break;
      case 'O': ink(ctx, ell(x, y, 8, 11, 16), t, { close: true, fill: P.agizIc, w: 3.2, seed }); break;
      case 'yamuk': ink(ctx, [[x - 13, y + 2], [x, y], [x + 12, y - 5]], t, { w: 4, seed }); break;
      case 'dalgali': ink(ctx, [[x - 15, y + 2], [x - 7, y - 2], [x, y + 2], [x + 7, y - 2], [x + 15, y + 2]], t, { w: 3.6, seed }); break;
      default: ink(ctx, [[x - 11, y], [x + 11, y]], t, { w: 4, seed });
    }
  }

  // ---------- ANSİKLOPEDİ (lambanın önünde, masada) ----------
  function ansiklopedi(ctx, t, ac, isik) {
    ac = Math.max(0, Math.min(1, ac));
    const e = ac < .5 ? 4 * ac * ac * ac : 1 - Math.pow(-2 * ac + 2, 3) / 2;
    const X = 290, Y = -6, Wk = 140, Hk = 42;          // sırt noktası, yarım genişlik, derinlik
    const sol = (dx, dy) => [X + dx, Y + dy];
    ctx.save();
    // gölge
    ctx.fillStyle = 'rgba(43,42,51,.18)'; ctx.beginPath(); ctx.ellipse(X - Wk * (1 - e) * .5, Y + 6, Wk * (.65 + .6 * e), 10, 0, 0, Math.PI * 2); ctx.fill();
    // kalınlık (sayfa kenarı) — kitap açıldıkça incelir
    const kal = 16 * (1 - e) + 6;
    ink(ctx, [sol(-Wk, 0), sol(Wk * e, 0), sol(Wk * e, -kal), sol(-Wk, -kal)].map(p => p), t, { close: true, fill: '#EFE4CB', w: 2.4, seed: 300 });
    // sol yarı: açıkken sayfa, kapalıyken görünmez (kapak altında)
    if (e > 0.02) {
      ink(ctx, [sol(-Wk, -kal), sol(0, -kal - 4), sol(-6, -kal - Hk - 8), sol(-Wk + 8, -kal - Hk)], t, { close: true, fill: '#F7EEDA', w: 2.6, seed: 310 });
    }
    // sağ yarı / kapak: sırt etrafında döner (cos ile yatay ölçek)
    const ang = Math.PI * (1 - e);                       // π kapalı (sola yatık kapak), 0 açık
    const k = Math.cos(ang);                             // -1 → 1
    const on = k > 0;                                    // sayfa yüzü görünüyor
    const ux = Wk * k, uy = -Math.sin(ang) * 46;         // kalkan kenar
    if (!on || e < .98) {
      // kapak (bordo, pirinç süslü)
      const kp = [sol(0, -kal - 4), sol(ux, -kal + uy - 2), sol(ux + 8 * k, -kal + uy - Hk - 4), sol(-6, -kal - Hk - 8)];
      if (!on) { ink(ctx, kp, t, { close: true, fill: P.bordo, w: 2.8, seed: 320 });
        const cx = ux / 2, cy = -kal + uy / 2 - Hk / 2 - 4;
        ink(ctx, [[X + cx - 18 * Math.abs(k), Y + cy], [X + cx + 18 * Math.abs(k), Y + cy]], t, { w: 2.4, color: P.pirinc, seed: 321 });
      }
    }
    if (on) {
      ink(ctx, [sol(0, -kal - 4), sol(ux, -kal + uy), sol(ux - 8, -kal + uy - Hk), sol(-6, -kal - Hk - 8)], t, { close: true, fill: '#F7EEDA', w: 2.6, seed: 330 });
    }
    // sayfa satırları + küçük şekil (tam açılınca)
    if (e > .85) {
      const a = (e - .85) / .15;
      ctx.save(); ctx.globalAlpha = a;
      for (let i = 0; i < 4; i++) {
        ink(ctx, [[X - Wk + 18, Y - kal - 10 - i * 7], [X - 14, Y - kal - 12 - i * 7]], t, { w: 1.6, color: 'rgba(43,42,51,.45)', seed: 340 + i, amp: .5 });
        ink(ctx, [[X + 14, Y - kal - 12 - i * 7], [X + Wk - 22, Y - kal - 10 - i * 7]], t, { w: 1.6, color: 'rgba(43,42,51,.45)', seed: 350 + i, amp: .5 });
      }
      ctx.restore();
    }
    // ışık sayfalara düşer + yükselen toz zerreleri
    const pa = e * isik;
    if (pa > .05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(X, Y - kal - Hk / 2, 4, X, Y - kal - Hk / 2, Wk * 1.4);
      g.addColorStop(0, `rgba(232,163,61,${.42 * pa})`); g.addColorStop(1, 'rgba(232,163,61,0)');
      const R = Wk * 1.4, cy = Y - kal - Hk / 2; ctx.fillStyle = g; ctx.fillRect(X - R, cy - R, 2 * R, 2 * R);
      for (let i = 0; i < 9; i++) {
        const f = ((t * .35 + h(i * 3.7)) % 1), x = X - Wk * .7 + h(i * 9.1) * Wk * 1.4 + Math.sin(t * 1.7 + i) * 6, y = Y - kal - 20 - f * 120;
        ctx.fillStyle = `rgba(255,214,140,${pa * .8 * Math.sin(f * Math.PI)})`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function basDonusumu(ctx, o, pz, t) {
    const nefes = Math.sin(t * 1.6) * 3, sallan = Math.sin(t * 1.15) * 0.022;
    ctx.translate(pz.bas[0], pz.bas[1] + nefes);
    ctx.rotate(pz.egim + sallan);
  }

  function drawNurBey(ctx, o = {}) {
    o = Object.assign({ x: 0, y: 0, s: 1, t: 0, ifade: 'anlatiyor', poz: 'dik', yon: 1, konusuyor: false, agiz: null, vizem: 'A', bak: null, isik: null, koni: true, kitap: null, zincir: 0 }, o);
    const t = o.t, F = IFADE[o.ifade] || IFADE.anlatiyor, pz = POZ[o.poz] || POZ.dik;
    const isik = (o.isik != null ? o.isik : (F.isik != null ? F.isik : .7)) + Math.sin(t * 7.3) * .03;
    const bak = o.bak != null ? o.bak : (F.bak || 0);
    let acik = null;
    if (o.konusuyor) acik = o.agiz != null ? o.agiz : Math.min(1, Math.abs(Math.sin(t * 8.7)) * .65 + Math.abs(Math.sin(t * 13.1)) * .35);
    const kirp = (t % 4.3) > 4.16 && F.gozTip === 'nokta';

    ctx.save();
    ctx.translate(o.x, o.y); ctx.scale(o.s * o.yon, o.s);

    // 1) ışık konisi (en arkada)
    if (o.koni && isik > 0) {
      ctx.save(); basDonusumu(ctx, o, pz, t); ctx.translate(55, 40);
      const g = ctx.createRadialGradient(0, 90, 10, 0, 260, 420);
      g.addColorStop(0, `rgba(232,163,61,${.5 * isik})`); g.addColorStop(1, 'rgba(232,163,61,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-100, 80); ctx.lineTo(100, 80); ctx.lineTo(330, 620); ctx.lineTo(-330, 620); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 2) gölge + taban
    ctx.save(); ctx.strokeStyle = 'rgba(43,42,51,.32)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 10; i++) { const x = -130 + i * 26; ctx.beginPath(); ctx.moveTo(x - 10, 6); ctx.lineTo(x + 10, -6); ctx.stroke(); } ctx.restore();
    ink(ctx, [[-112, -18], [-112, -2], [112, -2], [112, -18]], t, { fill: P.pirinc, seed: 2 });
    ink(ctx, ell(0, -20, 112, 24, 30), t, { close: true, fill: P.pirincAcik, seed: 4 });
    ink(ctx, ell(0, -24, 24, 7, 12), t, { close: true, fill: P.pirinc, w: 2.4, seed: 6 });

    // 3) kollar
    const dz = pz.dirsek; const ust = [pz.bas[0] - 28, pz.bas[1] + Math.sin(t * 1.6) * 3 + 6];
    ink(ctx, [[0, -26], dz, ust], t, { w: 13, seed: 8, amp: .8 });
    ink(ctx, [[0, -26], dz, ust], t, { w: 6.5, color: P.pirinc, seed: 8, amp: .8 });
    // yay (dirsekte detay)
    ctx.save(); ctx.strokeStyle = P.murekkep; ctx.lineWidth = 2;
    for (let i = 1; i <= 5; i++) { const u = i / 6, x = dz[0] * u, y = -26 + (dz[1] + 26) * u; ctx.beginPath(); ctx.arc(x + 9, y, 4, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
    ink(ctx, ell(dz[0], dz[1], 13, 13, 14), t, { close: true, fill: P.pirincAcik, seed: 10 });
    ink(ctx, ell(dz[0], dz[1], 4, 4, 8), t, { close: true, fill: P.murekkep, w: 0, seed: 11 });

    // 4) baş (şapka)
    ctx.save(); basDonusumu(ctx, o, pz, t);
    ink(ctx, ell(-28, 6, 11, 11, 12), t, { close: true, fill: P.pirincAcik, seed: 12 }); // mafsal
    ctx.translate(55, 40);
    // çekme zinciri (hep aşağı sarkar)
    ctx.save(); ctx.translate(-84, 58); ctx.rotate(-(pz.egim) + Math.sin(t * 2.1) * .12 + (o.ifade === 'kahkaha' ? Math.sin(t * 11) * .2 : 0));
    const zc = 9 + (o.zincir || 0) * 5;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(0, 8 + i * zc, 3.2, 0, Math.PI * 2); ctx.fillStyle = P.pirinc; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = P.murekkep; ctx.stroke(); }
    const zy = 8 + 7 * zc - 3;
    ink(ctx, [[-6, zy], [6, zy], [4, zy + 16], [-4, zy + 16]], t, { close: true, fill: P.pirincAcik, w: 2.4, seed: 14 });
    ctx.restore();
    // ampul
    ctx.save(); ctx.shadowColor = 'rgba(255,190,80,.95)'; ctx.shadowBlur = 50 * isik;
    ink(ctx, ell(0, 80, 40, 26, 22), t, { close: true, fill: `rgba(255,${200 + 30 * isik | 0},${120 + 40 * isik | 0},1)`, w: 2.6, seed: 16 });
    ctx.restore();
    // şapka gövdesi
    const SH = [[-112, 70], [-62, -70], [62, -70], [112, 70]];
    ink(ctx, [...SH, [60, 78], [0, 80], [-60, 78]], t, { close: true, fill: P.bordo, seed: 18 });
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = P.bordoKoyu; ctx.beginPath(); ctx.moveTo(62, -70); ctx.lineTo(112, 70); ctx.lineTo(70, 74); ctx.lineTo(36, -68); ctx.closePath(); ctx.fill(); ctx.restore();
    ink(ctx, [[-66, -70], [66, -70], [70, -86], [-70, -86]], t, { close: true, fill: P.pirinc, seed: 20 });
    ink(ctx, [[-108, 56], [108, 56]], t, { w: 3, color: P.pirinc, seed: 22 });
    ink(ctx, [[-110, 70], [110, 70], [104, 80], [-104, 80]], t, { close: true, fill: P.pirinc, w: 2.6, seed: 23 });
    // yüz
    kas(ctx, -32, -36, t, -1, F.kas[0], F.egik, 30);
    kas(ctx, 32, -36, t, 1, F.kas[1], F.egik, 31);
    const gz = kirp ? 'kapali' : null;
    goz(ctx, -32, -6, t, F.goz, bak, F.bakY, F.gozTip === 'mutlu' ? 'mutlu' : (F.gozTip === 'kirp' ? 'kapali' : gz), 40);
    goz(ctx, 32, -6, t, F.goz, bak, F.bakY, F.gozTip === 'mutlu' ? 'mutlu' : gz, 44);
    // yanak
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = '#E2735C';
    ctx.beginPath(); ctx.ellipse(-56, 20, 12, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(56, 20, 12, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    agiz(ctx, 0, 30, t, F.agiz, acik, o.vizem, 50);
    ctx.restore();

    // 5) ansiklopedi
    if (o.kitap != null) ansiklopedi(ctx, t, o.kitap, Math.max(0, isik));

    ctx.restore();
  }

  // İmza anı: zincir → ışık → ansiklopedi
  drawNurBey.acilis = function (t, t0) {
    const u = t - t0, cl = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
    if (u < 0) return { zincir: 0, isik: .12, kitap: 0, ifade: 'merakli' };
    const zincir = u < .5 ? Math.sin(cl(u, 0, .5) * Math.PI) : 0;
    const yan = cl(u, .5, 1.1);
    const titre = u > .5 && u < 1.1 ? (h(Math.floor(u * 24)) > .45 ? 1 : .25) : 1;
    const isik = .12 + .88 * yan * titre;
    const kitap = cl(u, .9, 2.1);
    return { zincir, isik, kitap, ifade: u < .5 ? 'merakli' : u < 2.1 ? 'saskin' : 'gulumsuyor' };
  };

  drawNurBey.IFADELER = Object.keys(IFADE);
  drawNurBey.POZLAR = Object.keys(POZ);
  drawNurBey.PALET = P;
  root.drawNurBey = drawNurBey;
})(typeof window !== 'undefined' ? window : globalThis);

export const drawNurBey = globalThis.drawNurBey;
