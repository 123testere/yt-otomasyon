// Keşif: yeni açılmış ve hızla büyüyen animasyon kanalları; Claude'un değerlendirdiği fırsatlar.
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { Card, colors, Dim, Pill, Screen, Section, sayi } from '../../components/ui';

export const DURUM = {
  'ornek-istendi': { label: 'Örnek bu gece yazılacak', renk: colors.warn },
  'ornek-yazildi': { label: 'Örnek hazırlanıyor', renk: colors.warn },
  'ornek-hazirlaniyor': { label: 'Örnek hazırlanıyor', renk: colors.warn },
  'ornek-hazir': { label: 'Örnek hazır', renk: colors.ok },
  'ornek-hata': { label: 'Örnek üretilemedi', renk: colors.err },
  baslatiliyor: { label: 'Kanal kuruluyor', renk: colors.accent2 },
  baslatildi: { label: 'Kanal yayında', renk: colors.ok },
};

export default function Kesif() {
  const { isAdmin } = useSession();
  const router = useRouter();
  const [liste, setListe] = useState([]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    return onSnapshot(collection(db, 'kesif'), (s) => setListe(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((k) => k.firsat && k.durum !== 'reddedildi')
      .sort((a, b) => (b.firsat.puan ?? 0) - (a.firsat.puan ?? 0))));
  }, [isAdmin]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={st.baslik}>Yeni kanal fırsatları</Text>
        <Dim style={{ marginBottom: 6 }}>Son 1 yılda açılıp hızla büyüyen animasyon kanalları. Claude bizim araçlarımızla özgün yapabileceklerimizi seçti.</Dim>
        {liste.length === 0 ? <Card><Dim>Henüz değerlendirilmiş fırsat yok. Tarama her cumartesi çalışır.</Dim></Card> : null}
        {liste.map((k) => {
          const f = k.firsat;
          const a = k.aday ?? {};
          const v = a.enIyi?.[0];
          const d = DURUM[k.durum];
          return (
            <Card key={k.id} onPress={() => router.push(`/kesif/${k.id}`)} style={{ padding: 0, overflow: 'hidden' }}>
              {v?.kapak ? <Image source={{ uri: v.kapak }} style={st.kapak} /> : null}
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Pill label={`${f.puan}/10`} renk={f.puan >= 8 ? colors.ok : f.puan >= 6 ? colors.warn : colors.dim} dolu />
                  <Pill label={(f.dil ?? '').toUpperCase()} renk={colors.accent2} />
                  <Pill label={f.tur === 'long' ? 'UZUN' : 'SHORTS'} renk={colors.accent} />
                  {d ? <Pill label={d.label} renk={d.renk} /> : null}
                </View>
                <Text style={st.kanal}>{f.kanalAdlari?.[0] ?? a.ad}</Text>
                <Dim style={{ marginTop: 2 }}>İlham: {a.ad} · {a.yasGun} günlük · {sayi(a.abone)} abone · günde ~{sayi(a.gunlukIzlenme)} izlenme</Dim>
                <Text style={st.konsept} numberOfLines={3}>{f.konsept}</Text>
              </View>
            </Card>
          );
        })}
        <Section>Nasıl çalışır?</Section>
        <Dim>1) Fırsata dokun, videolarını izle. 2) "Örnek yap" de: o tarza benzer ama özgün bir pilot ve kanal kimliği hazırlanır (hiçbir kanala yüklenmez). 3) Beğenirsen "Kanalı başlat": YouTube'da kanalı açıp bağlarsın, gerisi otomatik.</Dim>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  baslik: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginBottom: 6 },
  kapak: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.cardHi },
  kanal: { color: colors.text, fontSize: 18, fontWeight: '900' },
  konsept: { color: colors.text, marginTop: 8, lineHeight: 20 },
});
