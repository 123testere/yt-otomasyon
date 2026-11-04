import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { Button, Card, colors, Dim, Screen, Title } from '../components/ui';

// Ücretsiz YouTube API kotasıyla günde yaklaşık bu kadar video yüklenebilir.
const FREE_DAILY_UPLOADS = 6;

const EVENT_COLORS = { info: colors.ok, warn: colors.warn, error: colors.err };

function dailyUploads(settings) {
  if (!settings?.enabled) return 0;
  return (settings.shorts?.times?.length ?? 0) + (settings.long?.days?.length ?? 0) / 7;
}

function NotAdmin({ email }) {
  return (
    <Screen style={{ padding: 20 }}>
      <Card>
        <Title>Yetki bekleniyor</Title>
        <Dim style={{ marginTop: 8, lineHeight: 20 }}>
          Hesabın oluştu ama henüz yönetici değil. Bilgisayarda proje klasöründe şunu bir kez çalıştır:
        </Dim>
        <Text selectable style={st.code}>cd engine{'\n'}npm run yonetici-yap -- {email}</Text>
        <Dim>Sonra uygulamadan çıkış yapıp tekrar gir.</Dim>
      </Card>
      <Button kind="secondary" title="Çıkış yap" onPress={() => signOut(auth)} />
    </Screen>
  );
}

export default function Home() {
  const { user, isAdmin, options } = useSession();
  const router = useRouter();
  const [channels, setChannels] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const unsubChannels = onSnapshot(collection(db, 'channels'), (snap) =>
      setChannels(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.title.localeCompare(b.title))));
    const unsubEvents = onSnapshot(query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(15)), (snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => {
      unsubChannels();
      unsubEvents();
    };
  }, [isAdmin]);

  if (!user) return <Screen />;
  if (!isAdmin) return <NotAdmin email={user.email} />;

  const perDay = (channels ?? []).reduce((n, c) => n + dailyUploads(c.settings), 0);
  const nicheLabel = (s) => options.niches.find((n) => n.id === s?.niche)?.label ?? '—';

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Pressable onPress={() => router.push('/istatistik')} hitSlop={10}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>İstatistik</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/videos')} hitSlop={10}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Videolar</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Dim>Günlük yükleme planı</Dim>
            <Text style={[st.big, perDay > FREE_DAILY_UPLOADS && { color: colors.warn }]}>~{perDay.toFixed(1)} video</Text>
          </View>
          <Dim style={{ maxWidth: 160, textAlign: 'right' }}>
            {perDay > FREE_DAILY_UPLOADS
              ? `Ücretsiz kota ~${FREE_DAILY_UPLOADS}/gün. Fazlası ertesi güne kayar.`
              : `Ücretsiz kota içinde (~${FREE_DAILY_UPLOADS}/gün).`}
          </Dim>
        </Card>

        {channels?.length === 0 ? (
          <Card>
            <Title>Henüz kanal yok</Title>
            <Dim style={{ marginTop: 8, lineHeight: 20 }}>Aşağıdaki "Yeni kanal kur" ile ilk kanalını oluşturup bağla.</Dim>
          </Card>
        ) : null}

        {(channels ?? []).map((c) => (
          <Card key={c.id} onPress={() => router.push(`/channel/${c.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {c.thumbnail ? <Image source={{ uri: c.thumbnail }} style={st.avatar} /> : <View style={st.avatar} />}
              <View style={{ flex: 1 }}>
                <Title>{c.title}</Title>
                <Dim>{nicheLabel(c.settings)}</Dim>
              </View>
              <View style={[st.dot, { backgroundColor: c.settings?.enabled ? colors.ok : colors.border }]} />
            </View>
            <Dim style={{ marginTop: 10 }}>
              {c.settings?.enabled ? 'Otomasyon açık' : 'Otomasyon kapalı'}
              {' · '}Haftada {c.settings?.long?.days?.length ?? 0} uzun
              {' · '}Günde {c.settings?.shorts?.times?.length ?? 0} Shorts
            </Dim>
            {c.istatistik?.haftalik ? (
              <Dim style={{ marginTop: 4 }}>
                Son 7 gün: {Math.round(c.istatistik.haftalik.izlenme).toLocaleString('tr-TR')} izlenme
                {c.istatistik.toplam ? ` · ${c.istatistik.toplam.abone.toLocaleString('tr-TR')} abone` : ''}
              </Dim>
            ) : null}
            {c.needsReconnect ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: colors.err }}>Kanal izni düştü.</Text>
                <Button kind="secondary" title="Yeniden bağla" style={{ marginTop: 8 }}
                  onPress={() => router.push(`/kurulum?kanal=${c.id}&adim=bagla`)} />
              </View>
            ) : null}
          </Card>
        ))}

        <Button title="+ Yeni kanal kur" onPress={() => router.push('/kurulum')} style={{ marginBottom: 8 }} />

        <Text style={st.section}>Son olaylar</Text>
        {events.length === 0 ? <Dim>Henüz bir şey olmadı.</Dim> : null}
        {events.map((e) => (
          <View key={e.id} style={st.event}>
            <View style={[st.dot, { backgroundColor: EVENT_COLORS[e.level] ?? colors.dim, marginTop: 5 }]} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{e.title}</Text>
              <Dim>{e.body}</Dim>
              <Dim style={{ fontSize: 11, marginTop: 2 }}>{e.createdAt?.toDate?.().toLocaleString('tr-TR')}</Dim>
            </View>
          </View>
        ))}

        <Button kind="secondary" title="Çıkış yap" onPress={() => signOut(auth)} style={{ marginTop: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardHi, marginRight: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 10 },
  event: { flexDirection: 'row', marginBottom: 14 },
  code: { fontFamily: 'monospace', color: colors.text, backgroundColor: colors.bg, padding: 10, borderRadius: 8, marginVertical: 10 },
});
