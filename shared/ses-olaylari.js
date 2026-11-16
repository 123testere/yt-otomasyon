// Sahne verisinden sesler: temas efektleri (kılıç çarpması, adım, düşme, kapı, zincir…), mekân ortam sesi ve
// sahnenin ruh haline göre müzik. Görüntüyle aynı zamanlama kuralları kullanılır (remotion/src/Dizi.jsx → durum, zamanla):
// adım satir'e bağlıysa o satırın başından sayılır, ağır çekimde karakter hareketleri 0,3 hızında akar.
// Bağımlılıksızdır: hem çizici (Remotion) hem motor (müzik indirme) kullanır.

const KUM = ['arena', 'avlu', 'kervan', 'tas-ocagi', 'koy-gunduz', 'koy-yangin', 'meydan', 'yol', 'orman', 'fuar'];
// Mekân ortam sesleri: [ses, seviye]
const ORTAM = {
  kanal: [['ortam-su', 0.45], ['ortam-damla', 0.3]],
  zindan: [['ortam-ates', 0.1], ['ortam-damla', 0.28]],
  merdiven: [['ortam-ates', 0.14], ['ortam-damla', 0.28]],
  mahzen: [['ortam-damla', 0.32], ['ortam-su', 0.14]],
  arena: [['ortam-kalabalik', 0.22]],
  loca: [['ortam-kalabalik', 0.16]],
  'koy-yangin': [['ortam-ates', 0.45], ['ortam-ruzgar', 0.12]],
  kervan: [['ortam-ruzgar', 0.3]],
  'tas-ocagi': [['ortam-ruzgar', 0.18]],
  avlu: [['ortam-ruzgar', 0.1]],
  orman: [['ortam-ruzgar', 0.18]],
  yol: [['ortam-ruzgar', 0.14]],
  kuyu: [['ortam-ruzgar', 0.1], ['ortam-damla', 0.15]],
};
const KILIC = ['kilic', 'tahta-kilic', 'kilic+kalkan'];
const AGIR = 0.3; // ağır çekim hızı (Dizi.jsx ile aynı)

const satirSn = (sc, sn, satir) => {
  const s = Number.isInteger(satir) ? sc.satirlar?.[satir] : null;
  return s && typeof sn === 'number' ? s.t0 - sc.t0 + sn : (s ? s.t0 - sc.t0 : sn);
};

// Döner: [{ t (video sn), ses, vol, d? (ortam süresi), dongu? }]
export function sesOlaylari(scenes, karakterler = {}) {
  const ev = [];
  let sira = 0;
  scenes.forEach((sc) => {
    const yavas = (sc.efektler ?? []).includes('agir-cekim') ? 1 / AGIR : 1;
    const T = (u) => sc.t0 + u * yavas; // karakter/nesne zamanı (ağır çekimde yavaşlar)
    const Tm = (u) => sc.t0 + u; // mekân olayları (kapı, kapak, geçit) normal akar
    const son = sc.t0 + sc.d;
    const ekle = (t, ses, vol = 1) => { if (typeof t === 'number' && t >= sc.t0 - 0.01 && t < son - 0.05) ev.push({ t: Math.max(sc.t0, t), ses, vol }); };
    for (const [ses, vol] of ORTAM[sc.mekan] ?? []) {
      const v = ses === 'ortam-kalabalik' ? vol * (0.6 + 0.8 * (sc.kalabalik ?? 0.5)) : vol;
      ev.push({ t: sc.t0, ses, vol: v, d: sc.d, dongu: true });
    }
    const kum = KUM.includes(sc.mekan);
    const adimSes = () => (kum ? 'adim-kum' : (sira++ % 2 ? 'adim-tas2' : 'adim-tas'));
    const yuru = (u0, u1, kos, arka) => {
      const ara = kos ? 0.29 : 0.47;
      for (let u = u0 + 0.12; u < u1; u += ara) ekle(T(u), adimSes(), (kos ? 0.55 : 0.4) * (arka ? 0.6 : 1));
    };
    const zincirli = new Set(sc.zincir ? [sc.zincir.a, sc.zincir.b] : []);
    for (const k of sc.kadraj ?? []) {
      const def = karakterler[k.id] ?? {};
      let esya = k.esya !== undefined ? k.esya : def.esya ?? null;
      if (k.hareket) {
        const bas = k.hareket.bas ?? 0;
        yuru(bas, bas + Math.max(0.5, k.hareket.sure ?? sc.d * 0.6), k.hareket.kos, k.arka);
      }
      const adimlar = (k.adimlar ?? []).map((a) => ({ ...a, sn: satirSn(sc, a.sn ?? 0, a.satir) })).sort((a, b) => a.sn - b.sn);
      for (const a of adimlar) {
        if (a.esya !== undefined) {
          if (a.esya === 'anahtar' && esya !== 'anahtar') ekle(T(a.sn), 'anahtar', 0.6);
          esya = a.esya;
        }
        if ((a.x !== undefined || a.y !== undefined) && (a.sure ?? 0.35) >= 0.5) yuru(a.sn, a.sn + a.sure, a.kos, k.arka);
        if (a.poz === 'kilic-indir') ekle(T(a.sn), 'kilic-savurma', 0.65);
        if (a.poz === 'dus') ekle(T(a.sn + 0.45), 'dusme', 0.8);
        if (a.darbe) {
          ekle(T(a.sn), KILIC.includes(esya) ? ['kilic-carpma', 'kilic-carpma2', 'kilic-carpma3'][sira++ % 3] : 'gum', 1);
          if (zincirli.has(k.id)) ekle(T(a.sn + 0.05), 'zincir', 0.35);
        } else if (a.sarsinti) ekle(T(a.sn), 'gum', 0.7);
      }
    }
    for (const n of sc.nesneler ?? []) {
      if (!n.ucus) continue;
      const inis = satirSn(sc, n.ucus.sn1, n.satir);
      ekle(T(inis), n.tip === 'kilic' ? 'kilic-yere' : n.tip === 'anahtar' ? 'anahtar' : 'gum', 0.7);
    }
    const ac = (o) => (o && typeof o.ac === 'number' ? satirSn(sc, o.ac, o.satir) : null);
    if (ac(sc.kapi) !== null && ac(sc.kapi) >= 0) ekle(Tm(ac(sc.kapi)), 'kapi-gicirti', 0.8);
    if (ac(sc.yerKapak) !== null && ac(sc.yerKapak) >= 0) ekle(Tm(ac(sc.yerKapak)), 'kapak', 0.85);
    if (ac(sc.gecit) !== null && ac(sc.gecit) >= 0) ekle(Tm(ac(sc.gecit)), 'tas-surtme', 0.85);
    for (const z of sc.duvarZincir ?? []) {
      const takil = satirSn(sc, z.sn, z.satir);
      const coz = satirSn(sc, z.bitis, z.bitisSatir ?? z.satir);
      if (typeof takil === 'number' && takil >= 0) { ekle(T(takil), 'zincir', 0.6); ekle(T(takil + 0.05), 'kilit', 0.7); }
      if (typeof coz === 'number') { ekle(T(coz), 'kilit', 0.7); ekle(T(coz + 0.12), 'zincir', 0.6); }
    }
  });
  return ev.sort((a, b) => a.t - b.t);
}

// Sahnenin müziği: senaryoda sahne.muzik varsa o; yoksa sahnede olandan çıkarılır.
//   dövüş → epik · kaçış/koşu/ağır çekim/zorlanma → gerilim · hüzün → duygusal · arena/loca → epik
//   köy gündüz → huzurlu · zindan, kanal, mahzen, merdiven → gizemli · diğerleri → bölümün müziği
export function sahneMuzigi(sc, varsayilan = 'gizemli') {
  if (sc.muzik) return sc.muzik;
  const k = sc.kadraj ?? [];
  const adim = k.flatMap((x) => x.adimlar ?? []);
  const pozlar = [...k.map((x) => x.poz), ...adim.map((a) => a.poz), ...(sc.satirlar ?? []).map((s) => s.poz)];
  if (adim.some((a) => a.darbe) || pozlar.some((p) => ['kilic-indir', 'kilic-savur', 'saldir', 'blok'].includes(p))) return 'epik';
  if ((sc.efektler ?? []).includes('agir-cekim') || k.some((x) => x.hareket?.kos) || adim.some((a) => a.kos) || pozlar.some((p) => ['it', 'kaldir', 'korku', 'kos'].includes(p))) return 'gerilim';
  const ifade = [...k.map((x) => x.ifade), ...adim.map((a) => a.ifade), ...(sc.satirlar ?? []).map((s) => s.ifade)];
  if (ifade.includes('uzgun')) return 'duygusal';
  if (['arena', 'loca'].includes(sc.mekan)) return 'epik';
  if (['koy-gunduz', 'meydan'].includes(sc.mekan)) return 'huzurlu';
  if (['zindan', 'kanal', 'mahzen', 'merdiven', 'kule-ic', 'koy-yangin'].includes(sc.mekan)) return 'gizemli';
  return varsayilan;
}

// Müzik bölümleri: aynı ruh halindeki ardışık sahneler tek parça; 8 sn'den kısa bölüm öncekine katılır
// (müzik sık sık değişip dikkat dağıtmasın).
export function muzikBolumleri(scenes, varsayilan = 'gizemli', enAz = 8) {
  // Kısa videoda (ör. 20 sn) eşik süreyle orantılı küçülür
  const toplam = scenes.length ? scenes.at(-1).t0 + scenes.at(-1).d - scenes[0].t0 : 0;
  enAz = Math.min(enAz, toplam / 6);
  const parca = [];
  for (const sc of scenes) {
    const m = sahneMuzigi(sc, varsayilan);
    const son = parca.at(-1);
    if (son && son.mood === m) son.t1 = sc.t0 + sc.d;
    else parca.push({ mood: m, t0: sc.t0, t1: sc.t0 + sc.d });
  }
  for (let i = 1; i < parca.length; i++) {
    if (parca[i].t1 - parca[i].t0 < enAz) { parca[i - 1].t1 = parca[i].t1; parca.splice(i, 1); i--; }
  }
  if (parca.length > 1 && parca[0].t1 - parca[0].t0 < enAz) { parca[1].t0 = parca[0].t0; parca.shift(); }
  for (let i = 1; i < parca.length; i++) if (parca[i].mood === parca[i - 1].mood) { parca[i - 1].t1 = parca[i].t1; parca.splice(i, 1); i--; }
  return parca;
}
