// Özet: bütün kanalların YouTube + Instagram + TikTok + Facebook rakamları tek bakışta.
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { Bars, Card, colors, Dim, Kpi, PLATFORM, PlatformBadge, Screen, Section, sayi } from '../../components/ui';

const topla = (a, f) => a.reduce((n, x) => n + (f(x) ?? 0), 0);
const EVENT_RENK = { info: colors.ok, warn: colors.warn, error: colors.err };

export default function Ozet() {
  const { isAdmin } = useSession();
  const router = useRouter();
  const [kanallar, setKanallar] = useState([]);
  const [sosyal, setSosyal] = useState({});
  const [olaylar, setOlaylar] = useState([]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const u1 = onSnapshot(collection(db, 'channels'), (s) => setKanallar(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.id !== 'TEST_KANALI').sort((a, b) => (b.istatistik?.haftalik?.izlenme ?? 0) - (a.istatistik?.haftalik?.izlenme ?? 0))));
    const u2 = onSnapshot(collection(db, 'sosyal'), (s) => setSosyal(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))));
    const u3 = onSnapshot(query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(8)), (s) => setOlaylar(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, [isAdmin]);

  const ytHafta = topla(kanallar, (c) => c.istatistik?.haftalik?.izlenme);
  const ytAbone = topla(kanallar, (c) => c.istatistik?.toplam?.abone);
  const sv = Object.values(sosyal);
  const igTakipci = topla(sv, (x) => x.instagram?.takipci);
  const igIzlenme = topla(sv, (x) => topla(x.instagram?.videolar ?? [], (v) => v.izlenme));
  const ttTakipci = topla(sv, (x) => x.tiktok?.takipci);
  const ttIzlenme = topla(sv, (x) => topla(x.tiktok?.videolar ?? [], (v) => v.izlenme));
  const fbTakipci = topla(sv, (x) => x.facebook?.takipci);
  // Bütün kanalların son 30 günlük YouTube izlenmesi (günlük toplam)
  const gunler = {};
  for (const c of kanallar) for (const g of c.istatistik?.grafik ?? []) gunler[g.gun] = (gunler[g.gun] ?? 0) + g.izlenme;
  const seri = Object.keys(gunler).sort().slice(-30).map((g) => gunler[g]);
  const eksik = [...new Set(sv.flatMap((x) => [...(x.instagram?.eksikIzinler ?? []), ...(x.tiktok?.eksikIzinler ?? [])]))];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={st.merhaba}>Bugün nasıl gidiyor?</Text>

        <View style={st.satir}>
          <Kpi etiket="YouTube · 7 gün izlenme" deger={sayi(ytHafta)} renk={PLATFORM.yt.renk} />
          <Kpi etiket="Toplam abone" deger={sayi(ytAbone)} />
        </View>
        <View style={st.satir}>
          <Kpi etiket="Instagram takipçi" deger={sayi(igTakipci)} alt={igIzlenme ? `${sayi(igIzlenme)} Reels izlenme` : 'izlenme izni bekleniyor'} renk={PLATFORM.ig.renk} />
          <Kpi etiket="TikTok takipçi" deger={ttTakipci ? sayi(ttTakipci) : '—'} alt={ttIzlenme ? `${sayi(ttIzlenme)} izlenme` : 'istatistik izni bekleniyor'} renk={PLATFORM.tt.renk} />
        </View>
        {fbTakipci ? <View style={st.satir}><Kpi etiket="Facebook takipçi" deger={sayi(fbTakipci)} renk={PLATFORM.fb.renk} /></View> : null}

        {seri.length ? (
          <Card style={{ marginTop: 4 }}>
            <Dim>YouTube · son 30 gün (tüm kanallar)</Dim>
            <View style={{ marginTop: 10 }}><Bars veri={seri} renk={colors.accent} yukseklik={70} /></View>
          </Card>
        ) : null}

        {eksik.length ? (
          <Card style={{ borderColor: colors.warn }}>
            <Text style={{ color: colors.warn, fontWeight: '800' }}>Bazı istatistikler için izin gerekiyor</Text>
            <Dim style={{ marginTop: 4 }}>{eksik.join(', ')}</Dim>
          </Card>
        ) : null}

        <Section>Kanallar</Section>
        {kanallar.map((c) => {
          const s = sosyal[c.id] ?? {};
          const g = (c.istatistik?.grafik ?? []).slice(-14).map((x) => x.izlenme);
          return (
            <Card key={c.id} onPress={() => router.push(`/sosyal/${c.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {c.thumbnail ? <Image source={{ uri: c.thumbnail }} style={st.avatar} /> : <View style={st.avatar} />}
                <View style={{ flex: 1 }}>
                  <Text style={st.kanal} numberOfLines={1}>{c.title}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <PlatformBadge p="yt" />
                    <PlatformBadge p="ig" aktif={Boolean(s.instagram)} />
                    <PlatformBadge p="tt" aktif={Boolean(s.tiktok)} />
                    <PlatformBadge p="fb" aktif={Boolean(s.facebook)} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.buyuk}>{sayi(c.istatistik?.haftalik?.izlenme)}</Text>
                  <Dim style={{ fontSize: 11 }}>7 gün · {sayi(c.istatistik?.toplam?.abone)} abone</Dim>
                </View>
              </View>
              {g.length ? <View style={{ marginTop: 12 }}><Bars veri={g} renk={c.settings?.enabled ? colors.accent2 : colors.border} yukseklik={34} /></View> : null}
            </Card>
          );
        })}

        <Section sag={<Pressable onPress={() => router.push('/optimizasyon')}><Text style={st.link}>Optimizasyon →</Text></Pressable>}>Son olaylar</Section>
        {olaylar.map((e) => (
          <View key={e.id} style={st.olay}>
            <View style={[st.nokta, { backgroundColor: EVENT_RENK[e.level] ?? colors.dim }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{e.title}</Text>
              <Dim numberOfLines={3}>{e.body}</Dim>
              <Dim style={{ fontSize: 11, marginTop: 2 }}>{e.createdAt?.toDate?.().toLocaleString('tr-TR')}</Dim>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  merhaba: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.8, marginBottom: 14 },
  satir: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.cardHi, marginRight: 12 },
  kanal: { color: colors.text, fontSize: 16, fontWeight: '800' },
  buyuk: { color: colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: colors.accent, fontWeight: '800' },
  olay: { flexDirection: 'row', marginBottom: 14 },
  nokta: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
});
