import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button, Card, ChoiceChips, colors, Dim, Screen, StatusBadge } from '../components/ui';

const FILTERS = [
  { id: 'all', label: 'Hepsi' },
  { id: 'active', label: 'Sürüyor' },
  { id: 'uploaded', label: 'Yüklendi' },
  { id: 'problem', label: 'Sorunlu' },
];

const matches = (filter, status) => ({
  all: true,
  active: ['rendering', 'uploading', 'waiting-quota'].includes(status),
  uploaded: status === 'uploaded',
  problem: ['error', 'invalid', 'paused'].includes(status),
})[filter];

// Motorun kaydettiği küçük kapak; yoksa (eski videolar) YouTube'un kapak resmi.
function Thumb({ video }) {
  const short = video.type === 'short';
  const size = short ? { width: 72, height: 128 } : { width: 128, height: 72 };
  const uri = video.preview
    ? `data:image/jpeg;base64,${video.preview}`
    : video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : null;
  if (!uri) return <View style={[st.thumb, size]} />;
  return <Image source={{ uri }} style={[st.thumb, size]} resizeMode="cover" />;
}

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubVideos = onSnapshot(query(collection(db, 'videos'), orderBy('updatedAt', 'desc'), limit(100)), (snap) =>
      setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsubChannels = onSnapshot(collection(db, 'channels'), (snap) =>
      setChannels(Object.fromEntries(snap.docs.map((d) => [d.id, d.data().title]))));
    return () => {
      unsubVideos();
      unsubChannels();
    };
  }, []);

  const shown = useMemo(() => videos.filter((v) => matches(filter, v.status)), [videos, filter]);

  return (
    <Screen>
      <FlatList
        data={shown}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <ChoiceChips items={FILTERS} value={filter} onChange={setFilter} />
          </View>
        }
        ListEmptyComponent={<Dim>Bu filtrede video yok.</Dim>}
        renderItem={({ item: v }) => (
          <Card>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Thumb video={v} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}>
                  <Dim style={{ flex: 1 }} numberOfLines={1}>{channels[v.channelId] ?? v.channelId} · {v.type === 'short' ? 'Shorts' : 'Uzun'}</Dim>
                  <StatusBadge status={v.status} />
                </View>
                <Text style={st.title} numberOfLines={3}>{v.title}</Text>
                {v.publishAt ? (
                  <Dim style={{ marginTop: 4 }}>Yayın: {v.publishAt.toDate().toLocaleString('tr-TR')}</Dim>
                ) : null}
              </View>
            </View>
            {v.error ? <Text style={st.error} numberOfLines={4}>{v.error}</Text> : null}
            {v.warning ? <Dim style={{ marginTop: 4, color: colors.warn }}>{v.warning}</Dim> : null}
            {v.instagram ? (
              <Dim style={{ marginTop: 4, color: v.instagram.durum === 'hata' ? colors.err : v.instagram.durum === 'yayinlandi' ? colors.ok : colors.dim }}>
                Instagram: {{ bekliyor: 'yayın saatinde paylaşılacak', yayinlandi: 'paylaşıldı', hata: `gönderilemedi — ${v.instagram.hata ?? ''}` }[v.instagram.durum]}
              </Dim>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {v.url ? <Button kind="secondary" title="YouTube'da aç" onPress={() => Linking.openURL(v.url)} style={{ flex: 1 }} /> : null}
              {v.instagram?.permalink ? (
                <Button kind="secondary" title="Instagram'da aç" onPress={() => Linking.openURL(v.instagram.permalink)} style={{ flex: 1 }} />
              ) : null}
              {v.status === 'error' ? (
                <Button
                  title={v.retry ? 'Sırada' : 'Yeniden dene'}
                  disabled={v.retry}
                  onPress={() => updateDoc(doc(db, 'videos', v.id), { retry: true })}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  thumb: { borderRadius: 10, backgroundColor: colors.cardHi },
  error: { color: colors.err, marginTop: 6, fontSize: 12 },
});
