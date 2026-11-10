// Fırsat detayı: ilham kanalının videoları, Claude'un değerlendirmesi, örnek video (uygulama içinde oynatılır),
// kanal kimliği önizlemesi ve kararlar (Örnek yap / Başka açı / Kanalı başlat / İlgilenmiyorum).
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { File, Paths } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { db } from '../../lib/firebase';
import { Button, Card, colors, Dim, Pill, Screen, Section, sayi } from '../../components/ui';
import { DURUM } from '../(tabs)/kesif';

function Oynatici({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={st.video} nativeControls contentFit="contain" />;
}

function Madde({ baslik, metin, renk = colors.accent }) {
  if (!metin) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: renk, fontWeight: '900', fontSize: 13 }}>{baslik}</Text>
      <Text style={{ color: colors.text, lineHeight: 20, marginTop: 2 }}>{metin}</Text>
    </View>
  );
}

export default function KesifDetay() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [k, setK] = useState(null);
  const [gorsel, setGorsel] = useState(null);
  const [video, setVideo] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [not, setNot] = useState('');

  useEffect(() => onSnapshot(doc(db, 'kesif', id), (d) => setK(d.data())), [id]);
  useEffect(() => {
    if (k?.durum !== 'ornek-hazir' && k?.durum !== 'baslatildi' && k?.durum !== 'baslatiliyor') return;
    getDoc(doc(db, 'kesifGorsel', id)).then((d) => setGorsel(d.data() ?? null)).catch(() => {});
  }, [id, k?.durum, k?.ornek?.at?.seconds]);

  // Örnek video Firestore'da parçalar halinde: birleştirilip önbelleğe yazılır, uygulamada oynatılır
  const izle = async () => {
    setYukleniyor(true);
    try {
      const snap = await getDocs(query(collection(db, 'kesifVideo'), where('kesif', '==', id)));
      const parcalar = snap.docs.map((d) => d.data()).sort((a, b) => a.n - b.n);
      const dosya = new File(Paths.cache, `kesif-${id}-${k?.ornek?.at?.seconds ?? 0}.mp4`);
      if (!dosya.exists) dosya.write(parcalar.map((p) => p.veri).join(''), { encoding: 'base64' });
      setVideo(dosya.uri);
    } finally {
      setYukleniyor(false);
    }
  };

  if (!k) return <Screen />;
  const f = k.firsat ?? {};
  const a = k.aday ?? {};
  const d = DURUM[k.durum];
  const kimlik = k.kimlik;
  const istek = (durum) => updateDoc(doc(db, 'kesif', id), { durum, istekNot: not.trim() || null, istekAt: new Date() });

  return (
    <Screen>
      <Stack.Screen options={{ title: f.kanalAdlari?.[0] ?? a.ad ?? 'Fırsat' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Pill label={`Puan ${f.puan}/10`} renk={colors.ok} dolu />
          <Pill label={(f.dil ?? '').toUpperCase()} renk={colors.accent2} />
          {d ? <Pill label={d.label} renk={d.renk} /> : null}
        </View>

        <Section>İlham alınan kanal</Section>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {a.avatar ? <Image source={{ uri: a.avatar }} style={st.avatar} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={st.ad}>{a.ad}</Text>
              <Dim>{a.yasGun} günlük · {sayi(a.abone)} abone · {sayi(a.izlenme)} izlenme · günde ~{sayi(a.gunlukIzlenme)}</Dim>
            </View>
          </View>
        </Card>
        {(a.enIyi ?? []).map((v) => (
          <Pressable key={v.id} onPress={() => Linking.openURL(`https://youtu.be/${v.id}`)}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <Image source={{ uri: v.kapak }} style={st.kapak} />
              <View style={{ padding: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>{v.baslik}</Text>
                <Dim style={{ marginTop: 4 }}>{sayi(v.izlenme)} izlenme · {v.sure >= 60 ? `${Math.round(v.sure / 60)} dk` : `${v.sure} sn`} · dokun, YouTube'da izle</Dim>
              </View>
            </Card>
          </Pressable>
        ))}

        <Section>Claude'un değerlendirmesi</Section>
        <Card>
          <Madde baslik="Neden çalışıyor" metin={f.neden} />
          <Madde baslik="Bizim özgün açımız" metin={f.bizimAci} renk={colors.ok} />
          <Madde baslik="Konsept" metin={f.konsept} renk={colors.accent2} />
          <Madde baslik="Risk" metin={f.risk} renk={colors.warn} />
          <Madde baslik="Maliyet" metin={f.maliyet} renk={colors.dim} />
          <Madde baslik="Kanal adı önerileri" metin={(kimlik?.kanalAdlari ?? f.kanalAdlari ?? []).join(' · ')} renk={colors.dim} />
        </Card>

        {k.durum === 'ornek-hazir' || k.ornek ? (
          <>
            <Section>Örnek video</Section>
            <Card>
              <Text style={st.ad}>{k.ornek?.baslik}</Text>
              <Dim style={{ marginBottom: 10 }}>{k.ornek?.sure} sn · sadece sen görüyorsun, hiçbir kanala yüklenmedi</Dim>
              {video ? <Oynatici uri={video} /> : <Button title={yukleniyor ? 'Hazırlanıyor…' : '▶ Örneği izle'} loading={yukleniyor} onPress={izle} />}
            </Card>
          </>
        ) : null}

        {gorsel ? (
          <>
            <Section>Kanal kimliği (otomatik)</Section>
            <Card>
              <Image source={{ uri: `data:image/jpeg;base64,${gorsel.banner}` }} style={st.banner} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Image source={{ uri: `data:image/jpeg;base64,${gorsel.profil}` }} style={st.profil} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={st.ad}>{kimlik?.kanalAdlari?.[0]}</Text>
                  <Dim>{kimlik?.slogan}</Dim>
                </View>
              </View>
              <Dim style={{ marginTop: 10, lineHeight: 19 }}>{kimlik?.aciklama}</Dim>
            </Card>
          </>
        ) : null}

        {k.hata ? <Card style={{ borderColor: colors.err }}><Text style={{ color: colors.err }}>{k.hata}</Text></Card> : null}

        <Section>Karar</Section>
        {['ornek-istendi', 'ornek-yazildi', 'ornek-hazirlaniyor'].includes(k.durum) ? (
          <Card><Dim>Örnek isteği alındı. Claude bu gece pilot senaryoyu ve kanal kimliğini yazar; video hazır olunca bildirim gelir.</Dim></Card>
        ) : k.durum === 'baslatiliyor' || k.durum === 'baslatildi' ? (
          <Card><Dim>Bu fırsattan kanal kuruldu{k.kanal ? '' : ' (kuruluyor)'}.</Dim></Card>
        ) : (
          <>
            <TextInput value={not} onChangeText={setNot} placeholder="İsteğe bağlı not (ör. daha komik olsun, Türk karakterler)" placeholderTextColor={colors.dim} style={st.input} multiline />
            {k.ornek ? (
              <>
                <Button title="🚀 Kanalı başlat" onPress={() => router.push(`/kurulum?kesif=${id}`)} style={{ marginTop: 10 }} />
                <Button kind="secondary" title="Başka bir açıyla yeni örnek" onPress={() => istek('ornek-istendi')} style={{ marginTop: 8 }} />
              </>
            ) : (
              <Button title="Örnek yap" onPress={() => istek('ornek-istendi')} style={{ marginTop: 10 }} />
            )}
            <Button kind="secondary" title="İlgilenmiyorum" onPress={async () => { await istek('reddedildi'); router.back(); }} style={{ marginTop: 8 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: colors.cardHi },
  ad: { color: colors.text, fontSize: 16, fontWeight: '900' },
  kapak: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.cardHi },
  video: { width: '100%', aspectRatio: 9 / 16, maxHeight: 560, backgroundColor: '#000', borderRadius: 12 },
  banner: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  profil: { width: 64, height: 64, borderRadius: 32 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 60, textAlignVertical: 'top' },
});
