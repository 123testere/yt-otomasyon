// Optimizasyon: haftalık rapor, video karnesi (neden iyi / neden zayıf), A/B deneyleri, öğrenilen dersler,
// otomatik yapılan değişiklikler ve arama terimleri. Veriyi senkronizasyon yazar (engine/src/lib/optimize.js).
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { arrayUnion, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, ChoiceChips, colors, Dim, Screen, Title } from '../components/ui';

const ETIKET = {
  iyi: { ad: 'İyi', renk: colors.ok },
  normal: { ad: 'Normal', renk: colors.dim },
  zayif: { ad: 'Zayıf', renk: colors.err },
  erken: { ad: 'Erken', renk: colors.warn },
  'az-veri': { ad: 'Veri az', renk: colors.border },
};
const KAPAK_DURUM = {
  bekliyor: 'yeni kapak sırada', deneniyor: 'yeni kapak deneniyor', 'baslik-deneniyor': 'yeni başlık deneniyor',
  kazandi: 'değişiklik tuttu', 'geri-alindi': 'eski haline döndü', atlandi: 'atlandı', 'izin-yok': 'izin yok (yeniden bağla)',
};

const sayi = (n) => (n == null ? '—' : Math.round(n).toLocaleString('tr-TR'));
const yuzde = (x, carp = 1) => (x == null ? '—' : `%${(x * carp).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`);
const tarih = (v) => new Date(v?.toDate?.() ?? v);

function Rozet({ etiket }) {
  const e = ETIKET[etiket] ?? ETIKET.normal;
  return <Text style={[st.rozet, { borderColor: e.renk, color: e.renk }]}>{e.ad}</Text>;
}

function Egri({ egri }) {
  if (!egri?.length) return null;
  const max = Math.max(1, ...egri);
  return (
    <View style={{ marginTop: 8 }}>
      <Dim style={{ fontSize: 11 }}>İzleyici tutma eğrisi (videonun başından sonuna)</Dim>
      <View style={st.egri}>
        {egri.map((v, i) => (
          <View key={i} style={{ flex: 1, marginHorizontal: 1, justifyContent: 'flex-end' }}>
            <View style={{ height: Math.max(2, (v / max) * 50), backgroundColor: colors.accent, borderRadius: 2, opacity: 0.85 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function VideoSatiri({ p }) {
  const [acik, setAcik] = useState(false);
  const t = p.teshis ?? {};
  const kanca = p.tip === 'short' ? yuzde(p.kancaOran, 100) : yuzde(p.tutma30, 100);
  return (
    <Pressable onPress={() => setAcik(!acik)} style={st.video}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Rozet etiket={t.etiket} />
        <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }} numberOfLines={acik ? 3 : 1}>{p.baslik}</Text>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <Olcu ad="7 gün izlenme" deger={sayi(p.izlenme7)} />
        <Olcu ad="tıklanma" deger={yuzde(p.tiklanma7)} />
        <Olcu ad={p.tip === 'short' ? 'izlemeyi seçen' : 'ilk 30 sn'} deger={kanca} />
        <Olcu ad="izlenme %" deger={yuzde(p.tutma)} />
      </View>
      {acik ? (
        <View style={{ marginTop: 8 }}>
          <Dim style={{ fontSize: 12 }}>
            {p.tip === 'short' ? 'Shorts' : 'Uzun'} · {tarih(p.yayin).toLocaleDateString('tr-TR')} · toplam {sayi(p.izlenmeToplam)} izlenme
            {t.oran ? ` · ortalamanın ${t.oran.toLocaleString('tr-TR')} katı` : ''}
            {p.deneyId ? ` · deney ${p.kol} kolu` : ''}
          </Dim>
          {(t.nedenler ?? []).map((n, i) => (
            <Text key={i} style={{ color: n.iyi ? colors.ok : colors.err, fontSize: 13, marginTop: 4 }}>{n.iyi ? '▲' : '▼'} {n.metin}</Text>
          ))}
          {t.oneri ? <Text style={{ color: colors.text, fontSize: 13, marginTop: 6 }}>→ {t.oneri}</Text> : null}
          {p.kapakDeneme ? <Dim style={{ fontSize: 12, marginTop: 4 }}>Kapak denemesi: {KAPAK_DURUM[p.kapakDeneme.durum] ?? p.kapakDeneme.durum}</Dim> : null}
          <Egri egri={p.egri} />
          <Text style={{ color: colors.accent, marginTop: 8 }} onPress={() => Linking.openURL(`https://youtu.be/${p.youtubeId}`)}>YouTube'da aç</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Olcu({ ad, deger }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{deger}</Text>
      <Dim style={{ fontSize: 10 }}>{ad}</Dim>
    </View>
  );
}

export default function Optimizasyon() {
  const [channels, setChannels] = useState([]);
  const [sec, setSec] = useState(null);
  const [perfs, setPerfs] = useState([]);
  const [tip, setTip] = useState('hepsi');

  useEffect(() => onSnapshot(collection(db, 'channels'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.settings?.enabled).sort((a, b) => a.title.localeCompare(b.title));
    setChannels(list);
    setSec((cur) => cur ?? list[0]?.id ?? null);
  }), []);

  useEffect(() => {
    if (!sec) return undefined;
    return onSnapshot(query(collection(db, 'perf'), where('channelId', '==', sec)), (snap) =>
      setPerfs(snap.docs.map((d) => d.data()).sort((a, b) => tarih(b.yayin) - tarih(a.yayin))));
  }, [sec]);

  const c = channels.find((x) => x.id === sec);
  const opt = c?.optimizasyon ?? {};
  const silinen = new Set(c?.settings?.optimizasyon?.silinenDersler ?? []);
  const dersler = (opt.dersler ?? []).filter((d) => !silinen.has(d.id));
  const gosterilen = useMemo(() => perfs.filter((p) => tip === 'hepsi' || p.tip === tip), [perfs, tip]);
  const deneyde = (kol) => perfs.filter((p) => p.deneyId === opt.deney?.id && p.kol === kol);

  const dersSil = (d) => Alert.alert('Ders silinsin mi?', d.metin, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => updateDoc(doc(db, 'channels', sec), { 'settings.optimizasyon.silinenDersler': arrayUnion(d.id) }) },
  ]);

  if (!channels.length) return <Screen><Dim style={{ padding: 16 }}>Açık kanal yok.</Dim></Screen>;

  const rapor = opt.rapor;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ChoiceChips items={channels.map((x) => ({ id: x.id, label: x.title }))} value={sec} onChange={setSec} />

        {opt.reachIzin === false ? (
          <Text style={{ color: colors.warn, fontSize: 12, marginBottom: 8 }}>
            Kapak tıklanma oranı okunamıyor: kanalı bilgisayardan yeni izinlerle yeniden bağla. O zamana kadar 7 günlük izlenme kullanılır.
          </Text>
        ) : null}

        <Card>
          <Title>Gün sonu değerlendirmesi</Title>
          {opt.gunluk ? (
            <>
              <Dim style={{ fontSize: 12 }}>{opt.gunluk.tarih}</Dim>
              {(opt.gunluk.ozet ?? []).map((s, i) => <Text key={i} style={st.madde}>• {s}</Text>)}
              {(opt.gunluk.videolar ?? []).map((v, i) => (
                <View key={i} style={{ marginTop: 8 }}>
                  <Text style={[st.madde, { fontWeight: '700' }]}>{v.baslik}</Text>
                  <Dim style={{ fontSize: 12 }}>{v.izlenme ?? '?'} izlenme → hedef {v.hedef ?? '?'}</Dim>
                  {v.neden ? <Text style={st.madde}>Neden: {v.neden}</Text> : null}
                  {v.aksiyon ? <Text style={st.madde}>Yapılan: {v.aksiyon}</Text> : null}
                </View>
              ))}
              {(opt.gunluk.yarin ?? []).length ? <Dim style={{ fontSize: 12, marginTop: 8 }}>Yarın:</Dim> : null}
              {(opt.gunluk.yarin ?? []).map((s, i) => <Text key={i} style={st.madde}>→ {s}</Text>)}
            </>
          ) : <Dim>Her gece her kanal için yazılır: videolar ne aldı, iki katı için ne yapılıyor.</Dim>}
        </Card>

        <Card>
          <Title>Haftalık rapor</Title>
          {rapor ? (
            <>
              <Dim style={{ fontSize: 12 }}>{rapor.hafta} · {rapor.sayilar ? `${rapor.sayilar.iyi} iyi, ${rapor.sayilar.normal} normal, ${rapor.sayilar.zayif} zayıf` : ''}</Dim>
              {(rapor.yorum ?? rapor.otomatik ?? []).map((s, i) => <Text key={i} style={st.madde}>• {s}</Text>)}
              {!rapor.yorum ? <Dim style={{ fontSize: 11, marginTop: 6 }}>Yorumlu rapor bu gece eklenecek.</Dim> : null}
            </>
          ) : <Dim>İlk rapor bir sonraki pazartesi gelir. Ölçüler günde bir güncellenir.</Dim>}
        </Card>

        <Card>
          <Title>Deney</Title>
          {opt.deney ? (
            <>
              <Text style={st.madde}>{opt.deney.ad}</Text>
              <Dim style={{ fontSize: 12 }}>{opt.deney.hipotez}</Dim>
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                {['A', 'B'].map((k) => (
                  <View key={k} style={st.kol}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{k}: {opt.deney[k]}</Text>
                    <Dim style={{ fontSize: 12 }}>{deneyde(k).filter((p) => p.sabit).length}/3 video ölçüldü · {deneyde(k).length} yayında</Dim>
                  </View>
                ))}
              </View>
              <Dim style={{ fontSize: 11, marginTop: 6 }}>Başladı: {new Date(opt.deney.baslangic).toLocaleDateString('tr-TR')}. Her kolda 3 video 7 günlük veriyi tamamlayınca sonuç çıkar.</Dim>
            </>
          ) : <Dim>Süren deney yok{c?.settings?.optimizasyon?.deneyler === false ? ' (kanal ayarlarında kapalı)' : ''}.</Dim>}
          {(opt.gecmis ?? []).slice(-5).reverse().map((g, i) => (
            <View key={i} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.text }}>
                {g.ad} → <Text style={{ fontWeight: '700', color: g.sonuc?.kazanan === 'belirsiz' ? colors.dim : colors.ok }}>
                  {g.sonuc?.kazanan === 'belirsiz' ? 'belirgin fark yok' : `${g[g.sonuc?.kazanan]} kazandı`}
                </Text>
              </Text>
              {g.ders ? <Dim style={{ fontSize: 12 }}>{g.ders}</Dim> : null}
            </View>
          ))}
        </Card>

        <Card>
          <Title>Öğrenilen dersler</Title>
          <Dim style={{ fontSize: 12 }}>Senaryo yazarı bunlara uyar. Beğenmediğine uzun bas, silinsin.</Dim>
          {dersler.length ? dersler.map((d) => (
            <Pressable key={d.id} onLongPress={() => dersSil(d)}>
              <Text style={st.madde}>• {d.metin} <Text style={{ color: colors.dim, fontSize: 11 }}>({d.kaynak === 'deney' ? 'deney' : 'analiz'})</Text></Text>
            </Pressable>
          )) : <Dim style={{ marginTop: 6 }}>Henüz ders yok.</Dim>}
        </Card>

        {(opt.degisiklikler ?? []).length ? (
          <Card>
            <Title>Otomatik değişiklikler</Title>
            {[...opt.degisiklikler].reverse().slice(0, 10).map((d, i) => (
              <View key={i} style={{ marginTop: 6 }}>
                <Text style={{ color: colors.text, fontSize: 13 }}>{d.metin}</Text>
                <Dim style={{ fontSize: 11 }}>{new Date(d.tarih).toLocaleString('tr-TR')}</Dim>
              </View>
            ))}
          </Card>
        ) : null}

        {(opt.aramalar ?? []).length ? (
          <Card>
            <Title>Arama terimleri (son 28 gün)</Title>
            <Dim style={{ fontSize: 12 }}>İzleyicilerin kanalı bulduğu aramalar; başlık ve etiketlerde kullanılır.</Dim>
            {opt.aramalar.slice(0, 10).map((a) => (
              <View key={a.terim} style={st.satir}>
                <Text style={{ color: colors.text, flex: 1 }}>{a.terim}</Text>
                <Text style={{ color: colors.dim }}>{sayi(a.izlenme)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <Title>Video karnesi</Title>
          <Dim style={{ fontSize: 12, marginBottom: 6 }}>Her video kanalın kendi ortalamasıyla karşılaştırılır. Ayrıntı için dokun.</Dim>
          <ChoiceChips items={[{ id: 'hepsi', label: 'Hepsi' }, { id: 'short', label: 'Shorts' }, { id: 'long', label: 'Uzun' }]} value={tip} onChange={setTip} />
          {gosterilen.length ? gosterilen.map((p) => <VideoSatiri key={p.youtubeId} p={p} />)
            : <Dim>Henüz ölçülen video yok. Videolar yayından 1 gün sonra görünür.</Dim>}
        </Card>
        <Dim style={{ fontSize: 11 }}>
          Ölçüler günde bir güncellenir; YouTube verisi 1-2 gün gecikmeli gelir. "Veri az": karşılaştırma için yeterli izlenme yok.
        </Dim>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  rozet: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, fontSize: 11, fontWeight: '700' },
  video: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  egri: { flexDirection: 'row', alignItems: 'flex-end', height: 52, marginTop: 4 },
  madde: { color: colors.text, fontSize: 14, marginTop: 6, lineHeight: 20 },
  kol: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 10 },
  satir: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
});
