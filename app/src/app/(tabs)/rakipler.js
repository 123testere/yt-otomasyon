// Rakipler: aynı işi yapıp bizden başarılı kanalların patlayan videoları ve Claude'un analizi (haftalık).
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { Card, ChoiceChips, colors, Dim, Heat24, Pill, Screen, Section, sayi } from '../../components/ui';

function Liste({ baslik, maddeler, renk = colors.accent }) {
  if (!maddeler?.length) return null;
  return (
    <Card>
      <Text style={[st.kartBaslik, { color: renk }]}>{baslik}</Text>
      {maddeler.map((m, i) => <Text key={i} style={st.madde}>• {m}</Text>)}
    </Card>
  );
}

export default function Rakipler() {
  const { isAdmin } = useSession();
  const [kanallar, setKanallar] = useState([]);
  const [veri, setVeri] = useState({});
  const [sosyal, setSosyal] = useState({});
  const [sec, setSec] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const u1 = onSnapshot(collection(db, 'channels'), (s) => setKanallar(s.docs.map((d) => ({ id: d.id, title: d.data().title, enabled: d.data().settings?.enabled })).filter((c) => c.enabled)));
    const u2 = onSnapshot(collection(db, 'rakip'), (s) => setVeri(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))));
    const u3 = onSnapshot(collection(db, 'sosyal'), (s) => setSosyal(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))));
    return () => { u1(); u2(); u3(); };
  }, [isAdmin]);

  const secili = sec ?? kanallar.find((k) => veri[k.id])?.id ?? kanallar[0]?.id;
  const r = veri[secili];
  const rapor = r?.rapor;
  const aktif = sosyal[secili]?.instagram?.aktifSaatler;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ChoiceChips items={kanallar.map((k) => ({ id: k.id, label: k.title }))} value={secili} onChange={setSec} />
        {!r ? <Card style={{ marginTop: 14 }}><Dim>Bu kanal için henüz rakip taraması yok. Tarama her pazar akşamı çalışır.</Dim></Card> : null}

        {rapor ? (
          <>
            <Section>Bu hafta rakiplerde ne çalıştı?</Section>
            <Liste baslik="Özet" maddeler={rapor.ozet} />
            <Liste baslik="Bizim düzeltmemiz gerekenler" maddeler={rapor.bizimFark} renk={colors.warn} />
            <Liste baslik="Kapak kalıpları" maddeler={rapor.kapak} renk={colors.accent2} />
            <Liste baslik="Başlık kalıpları" maddeler={rapor.baslik} renk={colors.accent2} />
            <Liste baslik="İçerik ve yayın" maddeler={rapor.icerik} renk={colors.accent2} />
            {rapor.fikirler?.length ? (
              <>
                <Section>Video fikirleri (bizim yorumumuzla)</Section>
                {rapor.fikirler.map((f, i) => (
                  <Card key={i}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={st.fikir}>{f.baslikOnerisi ?? f.konu}</Text>
                      <Pill label={f.format === 'long' ? 'UZUN' : 'SHORTS'} renk={f.format === 'long' ? colors.accent : colors.accent2} />
                    </View>
                    {f.kapakYazisi ? <Text style={st.kapakYazi}>Kapak: {f.kapakYazisi}</Text> : null}
                    <Dim style={{ marginTop: 6 }}>{f.bizimAci}</Dim>
                    <Dim style={{ marginTop: 4, fontSize: 11 }}>İlham: {f.neden}</Dim>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ) : r ? <Card style={{ marginTop: 14 }}><Dim>Claude'un analizi bir sonraki gece çalışmasında gelecek.</Dim></Card> : null}

        {r?.patlayanlar?.length ? (
          <>
            <Section>Rakiplerde patlayan videolar</Section>
            {r.patlayanlar.map((p) => (
              <Pressable key={p.id} onPress={() => Linking.openURL(`https://youtu.be/${p.id}`)}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {p.kapak ? <Image source={{ uri: p.kapak }} style={st.kapak} /> : null}
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                      <Pill label={`${p.kat}× ortalama`} renk={colors.ok} dolu />
                      <Pill label={p.tur === 'long' ? `${Math.round(p.sure / 60)} dk` : 'Shorts'} renk={colors.dim} />
                      <Pill label={`${String(p.saat).padStart(2, '0')}:00`} renk={colors.dim} />
                    </View>
                    <Text style={st.vBaslik} numberOfLines={2}>{p.baslik}</Text>
                    <Dim style={{ marginTop: 4 }}>{p.rakip} · {sayi(p.izlenme)} izlenme</Dim>
                  </View>
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}

        {r?.rakipler?.length ? (
          <>
            <Section>Takip edilen rakipler</Section>
            <Card>
              {r.rakipler.map((k) => (
                <View key={k.id} style={st.rakip}>
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{k.ad}</Text>
                  <Dim>{sayi(k.abone)} abone · medyan {sayi(k.medyanIzlenme)}</Dim>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {(r?.saatDagilimi || aktif) ? (
          <>
            <Section>Yayın saatleri</Section>
            <Card>
              {aktif ? <Heat24 veri={aktif} renk="#E1306C" etiket="Instagram takipçilerin çevrimiçi olduğu saatler" /> : null}
              {r?.saatDagilimi ? <View style={{ marginTop: aktif ? 16 : 0 }}><Heat24 veri={r.saatDagilimi} etiket="Rakiplerin patlayan videolarını yayınladığı saatler" /></View> : null}
            </Card>
          </>
        ) : null}
        {r?.guncellendi ? <Dim style={{ textAlign: 'center', marginTop: 10, fontSize: 11 }}>Tarama: {r.guncellendi.toDate?.().toLocaleString('tr-TR')}</Dim> : null}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  kartBaslik: { fontWeight: '900', fontSize: 14, marginBottom: 6 },
  madde: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
  fikir: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 },
  kapakYazi: { color: colors.warn, fontWeight: '800', marginTop: 6 },
  kapak: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.cardHi },
  vBaslik: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rakip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
});
