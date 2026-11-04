// Kanal istatistikleri: 1 gün / 1 hafta / 1 ay / 1 yıl izlenme, izlenme süresi ve abone değişimi.
// Veriyi senkronizasyon yazar (engine/src/lib/stats.js → channels/{id}.istatistik).
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, ChoiceChips, colors, Dim, Screen, Title } from '../components/ui';

const DONEMLER = [
  { id: 'gun', label: '1 gün' }, { id: 'hafta', label: '1 hafta' }, { id: 'ay', label: '1 ay' }, { id: 'yil', label: '1 yıl' },
];

const sayi = (n) => (n == null ? '—' : Math.round(n).toLocaleString('tr-TR'));
const saat = (dk) => (dk == null ? '—' : `${(dk / 60).toLocaleString('tr-TR', { maximumFractionDigits: dk < 600 ? 1 : 0 })} sa`);
const isaretli = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${sayi(n)}`);

// Dönemin değerleri. "1 gün" için anlık sayaçtan son 24 saat (Analytics 1-2 gün geciktiği için), yoksa Analytics'in son günü.
function donem(ist, id) {
  if (!ist) return null;
  if (id === 'gun') {
    const a = ist.gunluk;
    if (ist.son24 && ist.son24.saat >= 20) return { izlenme: ist.son24.izlenme, dakika: a?.dakika, abone: a?.abone, not: 'son 24 saat (anlık)' };
    return a ? { ...a, not: `${ist.sonGun} (YouTube Analytics)` } : null;
  }
  const a = { hafta: ist.haftalik, ay: ist.aylik, yil: ist.yillik }[id];
  return a ? { ...a, not: ist.sonGun ? `${ist.sonGun} tarihine kadar` : '' } : null;
}

function Grafik({ veri }) {
  if (!veri?.length) return null;
  const max = Math.max(...veri.map((d) => d.izlenme), 1);
  return (
    <View style={{ marginTop: 14 }}>
      <View style={st.grafik}>
        {veri.map((d) => (
          <View key={d.gun} style={{ flex: 1, marginHorizontal: 1, justifyContent: 'flex-end' }}>
            <View style={{ height: Math.max(2, (d.izlenme / max) * 90), backgroundColor: colors.accent, borderRadius: 2 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Dim style={{ fontSize: 11 }}>{veri[0].gun.slice(5)}</Dim>
        <Dim style={{ fontSize: 11 }}>son 30 gün · en yüksek {sayi(max)}</Dim>
        <Dim style={{ fontSize: 11 }}>{veri.at(-1).gun.slice(5)}</Dim>
      </View>
    </View>
  );
}

function Kutu({ etiket, deger }) {
  return (
    <View style={st.kutu}>
      <Text style={st.deger}>{deger}</Text>
      <Dim style={{ fontSize: 12 }}>{etiket}</Dim>
    </View>
  );
}

function KanalKarti({ c, sec }) {
  const ist = c.istatistik;
  const d = donem(ist, sec);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {c.thumbnail ? <Image source={{ uri: c.thumbnail }} style={st.avatar} /> : <View style={st.avatar} />}
        <View style={{ flex: 1 }}>
          <Title>{c.title}</Title>
          <Dim>{ist?.toplam ? `${sayi(ist.toplam.abone)} abone · ${sayi(ist.toplam.izlenme)} toplam izlenme` : 'Henüz veri yok'}</Dim>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Kutu etiket="izlenme" deger={sayi(d?.izlenme)} />
        <Kutu etiket="izlenme süresi" deger={saat(d?.dakika)} />
        <Kutu etiket="abone" deger={isaretli(d?.abone)} />
      </View>
      {d?.not ? <Dim style={{ fontSize: 11, marginTop: 6 }}>{d.not}</Dim> : null}
      {ist?.analizHata ? (
        <Text style={{ color: colors.warn, fontSize: 12, marginTop: 6 }}>
          YouTube Analytics okunamadı{/has not been used|disabled/.test(ist.analizHata) ? ' (Google Cloud\'da API kapalı)' : ''}. 1 hafta/ay/yıl rakamları API açılınca gelir.
        </Text>
      ) : null}
      <Grafik veri={ist?.grafik} />
      {ist?.enIyi?.length ? (
        <View style={{ marginTop: 14 }}>
          <Dim style={{ marginBottom: 6 }}>Son 30 günün en çok izlenenleri</Dim>
          {ist.enIyi.map((v, i) => (
            <Pressable key={v.youtubeId} onPress={() => Linking.openURL(`https://youtu.be/${v.youtubeId}`)} style={st.satir}>
              <Text style={{ color: colors.dim, width: 18 }}>{i + 1}</Text>
              <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{v.baslik}</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{sayi(v.izlenme)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function Istatistik() {
  const [channels, setChannels] = useState(null);
  const [sec, setSec] = useState('hafta');
  useEffect(() => onSnapshot(collection(db, 'channels'), (snap) =>
    setChannels(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.title.localeCompare(b.title)))), []);

  const toplam = (channels ?? []).reduce((acc, c) => {
    const d = donem(c.istatistik, sec);
    return { izlenme: acc.izlenme + (d?.izlenme ?? 0), dakika: acc.dakika + (d?.dakika ?? 0), abone: acc.abone + (d?.abone ?? 0) };
  }, { izlenme: 0, dakika: 0, abone: 0 });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <ChoiceChips items={DONEMLER} value={sec} onChange={setSec} />
        <Card style={{ marginTop: 8 }}>
          <Dim>Bütün kanallar</Dim>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Kutu etiket="izlenme" deger={sayi(toplam.izlenme)} />
            <Kutu etiket="izlenme süresi" deger={saat(toplam.dakika)} />
            <Kutu etiket="abone" deger={isaretli(toplam.abone)} />
          </View>
        </Card>
        {(channels ?? []).map((c) => <KanalKarti key={c.id} c={c} sec={sec} />)}
        <Dim style={{ fontSize: 11, marginTop: 4 }}>
          Rakamlar saatte bir güncellenir. YouTube Analytics verisi 1-2 gün gecikmeli gelir; "1 gün" anlık sayaçtan hesaplanır.
        </Dim>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardHi, marginRight: 12 },
  kutu: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginHorizontal: 3, alignItems: 'center' },
  deger: { color: colors.text, fontSize: 20, fontWeight: '800' },
  grafik: { flexDirection: 'row', alignItems: 'flex-end', height: 92 },
  satir: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
});
