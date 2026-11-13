// Optimizasyon döngüsü (senkronizasyondan, kanal başına günde bir):
// ölçüler (perf.js) → tıklanma oranı (reach.js) → teşhis (analysis.js) → deney değerlendirme / yeni deney (deney.js)
// → zayıf kapak adayları → haftalık rapor. Durum channels/{id}.optimizasyon alanında, video ölçüleri perf/{youtubeId}'de.
import fs from 'node:fs';
import path from 'node:path';
import { options, resolveSettings } from './options.js';
import { dateInTz } from './time.js';
import { ROOT } from './paths.js';
import { channelDoneJobs, savePerfs, updatePerf } from './perf.js';
import { ReachIzinYok, fetchReach, reachUygula } from './reach.js';
import { haftalikOzet, medyan, teshis } from './analysis.js';
import { sahneAnalizi } from './sahne-analizi.js';

// Kimlik sözleşmesi: karakterler, sesler, anlatıcı ve görsel kimlik sabittir. Bunlarla ilgili "ders" kabul edilmez.
export const KIMLIK_YASAK = /karakter|nur bey|anlatıcı|anlatıcının|seslendir|sesi |sesin|ses tonu|görsel stil|çizim stil|stilini|stili |kimli[kğ]|logo|renk palet|seri adı|kanal adı|maskot|lamba figür/i;
export const kimlikDersiMi = (metin) => KIMLIK_YASAK.test(String(metin));
import { deneyBul, degerlendir, kazananAyari, sonrakiDeney } from './deney.js';
import { notify } from './notify.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;
const PERF_ARALIK = 20 * HOUR;
const REACH_TEKRAR = 3 * DAY; // izin yoksa 3 günde bir yeniden denenir (kanal yeniden bağlanınca kendiliğinden başlar)
const MAX_DERS = 12;
// 3 kapak testi: her uzun video (yedek kapak yazısı varsa) 2 günden sonra ve en az 50 gösterimle teste girer;
// gösterim az kalsa da 4. günden sonra başlar. Yedek kapağı olmayan eski videolarda yalnızca tıklanma zayıfsa
// (%3'ün ya da kanal medyanının %60'ının altı) başlık denemesi yapılır.
const KAPAK = { minYas: 2, maxYas: 30, minGosterim: 50, gecYas: 4, oran: 0.6, mutlak: 3 };
export const ANALIZ_DIR = path.join(ROOT, 'analiz');

// ISO hafta: "2026-W45" (İstanbul saatine göre)
export function haftaOf(now = new Date()) {
  const d = new Date(`${dateInTz(now, options.timezone)}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / DAY - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Firestore undefined kabul etmez.
function temiz(v) {
  if (Array.isArray(v)) return v.map(temiz);
  if (v && typeof v === 'object' && v.constructor === Object) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, temiz(x)]));
  }
  return v;
}

const normDers = (t) => String(t).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');

export function dersEkle(dersler, yeni) {
  const out = [...dersler];
  for (const d of yeni) {
    if (!d?.metin?.trim()) continue;
    if (out.some((x) => normDers(x.metin) === normDers(d.metin))) continue;
    out.push(d);
  }
  // Fazlaysa önce en eski analiz dersleri, sonra en eski deney dersleri gider.
  while (out.length > MAX_DERS) {
    const i = out.findIndex((x) => x.kaynak === 'analiz');
    out.splice(i >= 0 ? i : 0, 1);
  }
  return out;
}

// Senaryo yazarına giden dersler: kullanıcının uygulamadan sildikleri hariç.
export function aktifDersler(data) {
  // Kullanıcının sildikleri + güvenlik freninin geri aldıkları
  const silinen = new Set([...(data.settings?.optimizasyon?.silinenDersler ?? []), ...(data.optimizasyon?.geriAlinan ?? [])]);
  return (data.optimizasyon?.dersler ?? []).filter((d) => !silinen.has(d.id)).map((d) => d.metin);
}

// Kapak testi adayı: uzun video, 2-30 günlük, tıklanma verisi var.
//  - Yedek kapak yazısı varsa: her video teste girer (A asıl → B → C, en çok tıklanan kalır).
//  - Yalnızca yedek başlık varsa: tıklanma zayıfsa başlık denenir.
export function kapakAdayi(p, perfs, job, settings, now) {
  if (p.tip !== 'long' || p.kapakDeneme || !job) return false;
  const opt = settings.optimizasyon;
  const kapakVar = Boolean(opt.kapakDegistir && job.thumbnailTextAlt);
  const baslikVar = Boolean(opt.baslikDegistir && job.titleAlt);
  if (!kapakVar && !baslikVar) return false;
  const yas = (now.getTime() - new Date(p.yayin?.toDate?.() ?? p.yayin).getTime()) / DAY;
  if (yas < KAPAK.minYas || yas > KAPAK.maxYas || p.tiklanma7 == null) return false;
  if ((p.gosterim7 ?? 0) < KAPAK.minGosterim && yas < KAPAK.gecYas) return false;
  if (kapakVar) return true;
  const m = medyan(perfs.filter((q) => q.tip === 'long' && q.youtubeId !== p.youtubeId).map((q) => q.tiklanma7));
  return p.tiklanma7 < KAPAK.mutlak || (Boolean(m) && p.tiklanma7 < m * KAPAK.oran);
}

// Claude rutininin pazartesi yazdığı yorumlu rapor: analiz/<kanalId>.json { hafta, ozet: [..], dersler: [..] }
function claudeRaporu(channelId) {
  const file = path.join(ANALIZ_DIR, `${channelId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

async function sahneZamanlari(firestore, jobIds) {
  const out = {};
  for (const id of jobIds) {
    const v = (await firestore.doc(`videos/${id}`).get()).data();
    if (v?.sahneZaman) out[id] = v.sahneZaman;
  }
  return out;
}

async function deneyAdimi(firestore, doc, opt, settings, perfs, now) {
  const degisiklikler = [];
  if (opt.deney) {
    const katilan = perfs.filter((p) => p.deneyId === opt.deney.id && p.kol);
    const sonuc = degerlendir(opt.deney, katilan, now);
    if (sonuc) {
      const d = deneyBul(opt.deney.id);
      const kayit = { ...opt.deney, bitis: now.toISOString(), sonuc };
      if (sonuc.kazanan !== 'belirsiz') {
        kayit.ders = d.ders[sonuc.kazanan];
        if (d.motor && sonuc.kazanan === 'B') {
          const patch = kazananAyari(d.id, settings);
          if (patch) {
            await doc.ref.update(patch);
            degisiklikler.push({ tarih: now.toISOString(), metin: kayit.ders });
          }
        }
        if (!d.motor) opt.dersler = dersEkle(opt.dersler ?? [], [{ id: `deney-${d.id}-${now.getTime()}`, metin: kayit.ders, kaynak: 'deney', tarih: now.toISOString() }]);
      }
      opt.gecmis = [...(opt.gecmis ?? []), kayit].slice(-20);
      opt.deney = null;
      await notify({ title: 'Deney bitti', body: `${doc.data().title}: ${d.ad} → ${sonuc.kazanan === 'belirsiz' ? 'belirgin fark yok' : `${d[sonuc.kazanan].ad} kazandı`}`, channelId: doc.id });
    }
  }
  if (!opt.deney && settings.optimizasyon.deneyler) {
    const next = sonrakiDeney(settings, opt.gecmis ?? []);
    if (next) {
      const d = deneyBul(next.id);
      opt.deney = { ...next, ad: d.ad, hipotez: d.hipotez, A: d.A.ad, B: d.B.ad, baslangic: now.toISOString() };
    }
  }
  return degisiklikler;
}

// Kanal için günlük optimizasyon. Döner: { ozet (performans.json için), kapakIsi } ya da null (bugün zaten çalıştı).
export async function optimizeChannel(firestore, doc, now = new Date()) {
  const data = doc.data();
  const settings = resolveSettings(data.settings);
  const opt = { ...(data.optimizasyon ?? {}) };
  const sonPerf = opt.perfAt?.toMillis?.() ?? 0;
  if (now.getTime() - sonPerf < PERF_ARALIK) return null;

  const r = await updatePerf(firestore, doc, now);
  if (!r) return null;
  let { perfs } = r;

  // Tıklanma oranı (Reporting API): izin yoksa sessizce atlanır, uygulama "yeniden bağla" gösterir.
  const reachDenendi = opt.reachDenendi ? Date.parse(opt.reachDenendi) : 0;
  if (opt.reachIzin !== false || now.getTime() - reachDenendi > REACH_TEKRAR) {
    try {
      const res = await fetchReach(r.auth, opt.reach ?? {});
      opt.reach = { jobId: res.jobId, sonRapor: res.sonRapor };
      opt.reachIzin = true;
      perfs = perfs.map((p) => reachUygula(p, res.veri[p.youtubeId], now));
    } catch (e) {
      if (e instanceof ReachIzinYok) opt.reachIzin = false;
      else console.warn(`  ${doc.id} erişim raporu: ${e.message}`);
    }
    opt.reachDenendi = now.toISOString();
  }

  const jobs = channelDoneJobs(doc.id);
  const zamanlar = await sahneZamanlari(firestore, perfs.filter((p) => p.jobId && !p.sabit).map((p) => p.jobId));
  for (const p of perfs) {
    if (p.sabit && p.teshis && p.teshisSabit) continue;
    p.teshis = teshis(p, perfs, { job: jobs[p.jobId], sahneZaman: zamanlar[p.jobId], now });
    p.teshisSabit = Boolean(p.sabit);
    if (kapakAdayi(p, perfs, jobs[p.jobId], settings, now)) p.kapakDeneme = { durum: 'bekliyor', isaretlendi: now.toISOString() };
  }
  await savePerfs(firestore, perfs.map(temiz));

  const degisiklikler = await deneyAdimi(firestore, doc, opt, settings, perfs, now);
  opt.degisiklikler = [...(opt.degisiklikler ?? []), ...degisiklikler].slice(-30);

  // Haftalık rapor: haftanın ilk çalıştırmasında otomatik özet; Claude'un yorumu gelince eklenir.
  const hafta = haftaOf(now);
  if (opt.rapor?.hafta !== hafta) {
    // Güvenlik freni: kanal izlenmesi iki hafta üst üste düştüyse son 3 haftada eklenen en yeni ders geri alınır
    opt.haftalar = [...(opt.haftalar ?? []), { hafta, izlenme: data.istatistik?.haftalik?.izlenme ?? null }].slice(-8);
    const h = opt.haftalar.slice(-3).map((x) => x.izlenme);
    if (h.length === 3 && h.every((x) => typeof x === 'number') && h[2] < h[1] && h[1] < h[0]) {
      const geri = new Set(opt.geriAlinan ?? []);
      const aday = [...(opt.dersler ?? [])].reverse().find((d) => !geri.has(d.id) && now - Date.parse(d.tarih) <= 21 * DAY);
      if (aday) {
        opt.geriAlinan = [...geri, aday.id];
        const metin = `İzlenme iki hafta üst üste düştü; son eklenen kural geri alındı: “${aday.metin}”`;
        opt.degisiklikler = [...(opt.degisiklikler ?? []), { tarih: now.toISOString(), metin }].slice(-30);
        await notify({ title: 'Optimizasyon: kural geri alındı', body: `${data.title}: ${metin}`.slice(0, 180), channelId: doc.id });
      }
    }
    const ozet = haftalikOzet(perfs, now);
    opt.rapor = { hafta, olusturuldu: now.toISOString(), otomatik: ozet.satirlar, sayilar: { iyi: ozet.iyi, normal: ozet.normal, zayif: ozet.zayif }, yorum: null };
    await notify({ title: 'Haftalık rapor hazır', body: `${data.title}: ${ozet.satirlar[0]}`, channelId: doc.id });
  }
  const claude = claudeRaporu(doc.id);
  if (claude?.hafta === hafta && opt.rapor.yorumHafta !== hafta && Array.isArray(claude.ozet)) {
    opt.rapor.yorum = claude.ozet.filter((s) => typeof s === 'string').slice(0, 6);
    opt.rapor.yorumHafta = hafta;
    // Kimlikle (karakter, ses, görsel stil) ilgili dersler kabul edilmez
    opt.dersler = dersEkle(opt.dersler ?? [], (claude.dersler ?? []).filter((s) => typeof s === 'string' && !kimlikDersiMi(s)).slice(0, 3)
      .map((metin, i) => ({ id: `analiz-${hafta}-${i}`, metin: metin.slice(0, 200), kaynak: 'analiz', tarih: now.toISOString() })));
  }

  opt.aramalar = r.aramalar ?? opt.aramalar ?? [];
  opt.perfAt = now;
  // Sahne analizi: hangi tür sahnede izleyici kaybediliyor (Shorts ve uzun video ayrı)
  const tumZaman = await sahneZamanlari(firestore, perfs.filter((p) => p.jobId).map((p) => p.jobId));
  const sahne = {
    short: sahneAnalizi(perfs.filter((p) => p.tip === 'short'), jobs, tumZaman),
    long: sahneAnalizi(perfs.filter((p) => p.tip === 'long'), jobs, tumZaman),
  };
  opt.sahneAnalizi = sahne;
  await doc.ref.update({ optimizasyon: temiz(opt) });

  return {
    kapakIsi: perfs.some((p) => p.kapakDeneme && ['bekliyor', 'deneniyor', 'baslik-deneniyor'].includes(p.kapakDeneme.durum)),
    ozet: { ...performansOzeti(doc, opt, perfs, hafta), sahneAnalizi: sahne },
  };
}

// config/performans.json'daki kanal kaydı (Claude rutini haftalık yorumu buna bakarak yazar).
export function performansOzeti(doc, opt, perfs, hafta) {
  const tarih = (v) => new Date(v?.toDate?.() ?? v).toISOString().slice(0, 10);
  return {
    channelId: doc.id,
    title: doc.data().title,
    hafta,
    raporGerekli: opt.rapor?.yorumHafta !== hafta,
    otomatikRapor: opt.rapor?.otomatik ?? [],
    deney: opt.deney ?? null,
    sonDeneyler: (opt.gecmis ?? []).slice(-3).map((g) => ({ ad: g.ad, kazanan: g.sonuc?.kazanan, ders: g.ders ?? null })),
    dersler: (opt.dersler ?? []).map((d) => d.metin),
    aramaTerimleri: (opt.aramalar ?? []).slice(0, 10),
    videolar: [...perfs].sort((a, b) => tarih(b.yayin).localeCompare(tarih(a.yayin))).slice(0, 20).map((p) => ({
      youtubeId: p.youtubeId, jobId: p.jobId ?? null, gosterim7: p.gosterim7 ?? null,
      kapakDeneme: p.kapakDeneme?.durum ?? null, sonIyilestirme: p.iyilestirmeler?.at(-1)?.tarih ?? null,
      baslik: p.baslik, tip: p.tip, yayin: tarih(p.yayin), izlenme7: p.izlenme7, tutma: p.tutma, kancaOran: p.kancaOran,
      // Gün sonu değerlendirmesi için: toplam izlenme, son günün artışı, hedef (bugünkünün iki katı), etkileşim
      izlenme: p.izlenmeToplam ?? null, izlenmeArtis: p.izlenmeArtis ?? null, hedef: Math.max(100, (p.izlenmeToplam ?? 0) * 2),
      abone7: p.abone7 ?? null, begeni7: p.begeni7 ?? null, yorum7: p.yorum7 ?? null,
      tutma30: p.tutma30, tiklanma7: p.tiklanma7 ?? null, etiket: p.teshis?.etiket, nedenler: p.teshis?.nedenler?.map((n) => n.metin) ?? [],
      deney: p.deneyId ? `${p.deneyId}/${p.kol}` : null,
    })),
  };
}

