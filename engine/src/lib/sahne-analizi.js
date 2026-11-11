// Sahne analizi: izleyicinin hangi tür sahnede kaybedildiği.
// Her videonun tutma eğrisi (perf.egri: 20 nokta, izleyicinin yüzde kaçı o anda izliyor) ile sahne başlangıç
// zamanları (videos.sahneZaman) eşleştirilir; her sahnenin saniye başına izleyici kaybı, sahnenin özelliklerine
// (kanca, rakam yazısı, kart, mekân, cümle uzunluğu…) göre toplanır ve kanal ortalamasıyla kıyaslanır.
// Sonuç Claude'a gider (config/performans.json → sahneAnalizi); kimlik değil, içerik kuralları çıkarılır.

const MIN_VIDEO = 3;
const MIN_SAHNE = 4;

// Eğride t saniyesindeki izlenme oranı (doğrusal ara değer)
function oranAt(egri, sure, t) {
  const n = egri.length;
  const x = Math.max(0, Math.min(1, t / sure)) * n - 1; // egri[i] = (i+1)/n anı
  if (x <= 0) return 1 + (egri[0] - 1) * Math.max(0, (x + 1));
  const i = Math.min(n - 2, Math.floor(x));
  return egri[i] + (egri[i + 1] - egri[i]) * (x - i);
}

const kelime = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

// Sahnenin özellik etiketleri (formatlara göre)
function ozellikler(job, sc, i, son) {
  const o = [];
  if (i === 0) o.push('ilk sahne (kanca)');
  if (i === son) o.push('son sahne (kapanış)');
  if (job.format === 'dizi') {
    const metin = (sc.satirlar ?? []).map((s) => s.metin).join(' ');
    o.push(`mekân: ${sc.mekan}`);
    if (sc.buyukYazi) o.push('ekranda dev yazı/rakam');
    if (sc.sira) o.push('sıralama kartı');
    if (sc.haber) o.push('haber kartı');
    if (sc.veri) o.push('satış grafiği');
    if (sc.kart) o.push('kısım kartı (siyah ekran)');
    if (!(sc.kadraj ?? []).length && !sc.sira && !sc.haber) o.push('karaktersiz sahne');
    if ((sc.satirlar ?? []).some((s) => s.kim && s.kim !== 'anlatici')) o.push('karakter diyaloğu');
    const k = kelime(metin);
    o.push(k <= 12 ? 'kısa anlatım (≤12 kelime)' : k <= 25 ? 'orta anlatım (13-25 kelime)' : 'uzun anlatım (25+ kelime)');
  } else if (job.format === 'cizim') {
    o.push(sc.cizim !== undefined ? 'mürekkep çizimi' : 'arşiv görseli');
    if (sc.bolum) o.push('bölüm başı');
    const k = kelime(sc.narration);
    o.push(k <= 12 ? 'kısa cümle (≤12 kelime)' : k <= 22 ? 'orta cümle (13-22 kelime)' : 'uzun cümle (22+ kelime)');
    if (/\d/.test(sc.narration ?? '')) o.push('rakam/tarih içeren cümle');
    if (/\?/.test(sc.narration ?? '')) o.push('soru cümlesi');
  } else {
    o.push(sc.visual?.motion ? `grafik: ${sc.visual.motion.type}` : 'sadece görsel');
    const k = kelime(sc.narration);
    o.push(k <= 25 ? 'kısa sahne' : k <= 50 ? 'orta sahne' : 'uzun sahne');
  }
  return o;
}

// perfs: perf belgeleri (egri, sure, jobId, tip); jobs: {jobId: senaryo}; zamanlar: {jobId: [sahne başlangıçları]}
export function sahneAnalizi(perfs, jobs, zamanlar) {
  const toplam = {}; // özellik → { kayip, sure, sayi, videolar:Set }
  let genelKayip = 0;
  let genelSure = 0;
  let videoSayisi = 0;
  const kancalar = [];
  for (const p of perfs) {
    const job = jobs[p.jobId];
    const zaman = zamanlar[p.jobId];
    if (!job?.scenes?.length || !p.egri?.length || !p.sure || !zaman?.length) continue;
    videoSayisi++;
    const son = job.scenes.length - 1;
    job.scenes.forEach((sc, i) => {
      const bas = zaman[i] ?? 0;
      const bit = Math.min(p.sure, zaman[i + 1] ?? p.sure);
      const d = bit - bas;
      if (d <= 0.5) return;
      const kayip = Math.max(0, oranAt(p.egri, p.sure, bas) - oranAt(p.egri, p.sure, bit));
      genelKayip += kayip;
      genelSure += d;
      for (const oz of ozellikler(job, sc, i, son)) {
        const x = (toplam[oz] ??= { kayip: 0, sure: 0, sayi: 0, videolar: new Set() });
        x.kayip += kayip; x.sure += d; x.sayi++; x.videolar.add(p.youtubeId);
      }
    });
    // Kanca: ilk sahnenin uzunluğu ve 3. saniyedeki tutma
    const ilk = job.scenes[0];
    const ilkMetin = ilk.narration ?? (ilk.satirlar ?? []).map((s) => s.metin).join(' ');
    kancalar.push({ kelime: kelime(ilkMetin), tutma3: Math.round(oranAt(p.egri, p.sure, Math.min(3, p.sure)) * 100), tip: p.tip });
  }
  if (videoSayisi < MIN_VIDEO || !genelSure) return { videoSayisi, yeterli: false };
  const ortalama = genelKayip / genelSure; // saniye başına izleyici kaybı
  const satirlar = Object.entries(toplam)
    .filter(([, x]) => x.sayi >= MIN_SAHNE && x.videolar.size >= 2)
    .map(([oz, x]) => ({ ozellik: oz, sahne: x.sayi, video: x.videolar.size, oran: Math.round(((x.kayip / x.sure) / ortalama) * 100) / 100 }));
  return {
    videoSayisi,
    yeterli: true,
    aciklama: 'oran: o tür sahnede saniye başına izleyici kaybı / kanal ortalaması (1.3 = %30 daha fazla kayıp)',
    enCokKaybettiren: satirlar.filter((s) => s.oran >= 1.15).sort((a, b) => b.oran - a.oran).slice(0, 6),
    enIyiTutan: satirlar.filter((s) => s.oran <= 0.85).sort((a, b) => a.oran - b.oran).slice(0, 6),
    kanca: {
      kisa: ortTutma(kancalar.filter((k) => k.kelime <= 10)),
      uzun: ortTutma(kancalar.filter((k) => k.kelime > 10)),
      aciklama: 'ilk sahne ≤10 kelime / >10 kelime iken 3. saniyede izleyicilerin yüzde kaçı kalıyor',
    },
  };
}

function ortTutma(a) {
  return a.length ? { video: a.length, tutma3: Math.round(a.reduce((n, k) => n + k.tutma3, 0) / a.length) } : null;
}
