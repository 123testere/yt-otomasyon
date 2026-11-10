// Kanal detayı: YouTube + Instagram + TikTok + Facebook rakamları ve video listeleri, aktif saatler.
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bars, Button, Card, ChoiceChips, colors, Dim, Heat24, Kpi, PLATFORM, Screen, Section, sayi } from '../../components/ui';

function VideoSatiri({ v, renk }) {
  return (
    <Pressable onPress={() => v.permalink && Linking.openURL(v.permalink)} style={st.video}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>{v.baslik || '(başlıksız)'}</Text>
        <Dim style={{ fontSize: 11, marginTop: 2 }}>{v.at ? new Date(v.at).toLocaleDateString('tr-TR') : ''}</Dim>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
        <Text style={{ color: renk, fontWeight: '900', fontSize: 16 }}>{v.izlenme != null ? sayi(v.izlenme) : '—'}</Text>
        <Dim style={{ fontSize: 11 }}>♥ {sayi(v.begeni)} · 💬 {sayi(v.yorum)}{v.paylasim != null ? ` · ↗ ${sayi(v.paylasim)}` : ''}</Dim>
      </View>
    </Pressable>
  );
}

export default function SosyalDetay() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [kanal, setKanal] = useState(null);
  const [s, setS] = useState({});
  const [p, setP] = useState('yt');

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'channels', id), (d) => setKanal(d.data()));
    const u2 = onSnapshot(doc(db, 'sosyal', id), (d) => setS(d.data() ?? {}));
    return () => { u1(); u2(); };
  }, [id]);

  const ist = kanal?.istatistik;
  const platformlar = [{ id: 'yt', label: 'YouTube' }, ...(s.instagram ? [{ id: 'ig', label: 'Instagram' }] : []), ...(s.tiktok ? [{ id: 'tt', label: 'TikTok' }] : []), ...(s.facebook ? [{ id: 'fb', label: 'Facebook' }] : [])];
  const pv = { ig: s.instagram, tt: s.tiktok, fb: s.facebook }[p];
  const renk = PLATFORM[p].renk;

  return (
    <Screen>
      <Stack.Screen options={{ title: kanal?.title ?? 'Kanal' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ChoiceChips items={platformlar} value={p} onChange={setP} />

        {p === 'yt' ? (
          <>
            <View style={st.satir}>
              <Kpi etiket="7 gün izlenme" deger={sayi(ist?.haftalik?.izlenme)} renk={renk} />
              <Kpi etiket="Abone" deger={sayi(ist?.toplam?.abone)} alt={ist?.haftalik?.abone != null ? `7 günde ${ist.haftalik.abone > 0 ? '+' : ''}${ist.haftalik.abone}` : null} />
            </View>
            <View style={st.satir}>
              <Kpi etiket="30 gün izlenme" deger={sayi(ist?.aylik?.izlenme)} />
              <Kpi etiket="30 gün izlenme süresi" deger={ist?.aylik?.dakika != null ? `${sayi(ist.aylik.dakika / 60)} sa` : '—'} />
            </View>
            {ist?.grafik?.length ? <Card><Dim>Son 30 gün</Dim><View style={{ marginTop: 10 }}><Bars veri={ist.grafik.map((g) => g.izlenme)} renk={renk} yukseklik={70} /></View></Card> : null}
            <Button kind="secondary" title="Videolar ve teşhis" onPress={() => router.push('/videolar')} style={{ marginTop: 4 }} />
            <Button kind="secondary" title="Kanal ayarları" onPress={() => router.push(`/channel/${id}`)} style={{ marginTop: 8 }} />
          </>
        ) : pv?.hata ? (
          <Card style={{ marginTop: 14 }}><Text style={{ color: colors.err }}>Veri alınamadı: {pv.hata}</Text></Card>
        ) : pv ? (
          <>
            <View style={st.satir}>
              <Kpi etiket="Takipçi" deger={sayi(pv.takipci)} renk={renk} />
              <Kpi etiket={p === 'tt' ? 'Toplam beğeni' : '28 gün erişim'} deger={sayi(p === 'tt' ? pv.begeniToplam : pv.erisim28)} />
            </View>
            {pv.eksikIzinler?.length ? <Card style={{ borderColor: colors.warn }}><Text style={{ color: colors.warn, fontWeight: '700' }}>Eksik izin: {pv.eksikIzinler.join(', ')}</Text><Dim style={{ marginTop: 4 }}>Bu izinler eklenince izlenme ve erişim rakamları da gelir.</Dim></Card> : null}
            {pv.aktifSaatler ? <Card><Heat24 veri={pv.aktifSaatler} renk={renk} etiket="Takipçilerin çevrimiçi olduğu saatler" /></Card> : null}
            {pv.videolar?.length ? (
              <>
                <Section>Son paylaşımlar</Section>
                <Card>{pv.videolar.map((v) => <VideoSatiri key={v.id} v={v} renk={renk} />)}</Card>
              </>
            ) : null}
          </>
        ) : null}
        {s.guncellendi ? <Dim style={{ textAlign: 'center', marginTop: 10, fontSize: 11 }}>Sosyal veriler: {s.guncellendi.toDate?.().toLocaleString('tr-TR')}</Dim> : null}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  satir: { flexDirection: 'row', gap: 10, marginTop: 12 },
  video: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});
