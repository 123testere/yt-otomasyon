// Sıfırdan kanal kurulumu: 1) YouTube'da kanalı oluştur 2) telefondan bağla 3) kanal kimliği 4) içerik ayarları.
// ?kanal=<id>&adim=bagla|kimlik ile var olan bir kanalı yeniden bağlamak ya da kimliğini düzenlemek için de açılır.
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { saveChannel, startDeviceFlow, waitForApproval } from '../lib/youtube-connect';
import { Button, Card, ChoiceChips, colors, Dim, Label, Screen, Title } from '../components/ui';

const ADIMLAR = ['olustur', 'bagla', 'kimlik', 'icerik'];
const BASLIK = { olustur: 'Kanalı oluştur', bagla: 'Kanalı bağla', kimlik: 'Kanal kimliği', icerik: 'İçerik ayarları' };

const ULKELER = [
  { id: 'TR', label: 'Türkiye' }, { id: 'DE', label: 'Almanya' }, { id: 'AT', label: 'Avusturya' },
  { id: 'US', label: 'ABD' }, { id: 'GB', label: 'Birleşik Krallık' }, { id: 'FR', label: 'Fransa' },
];

function Adimlar({ adim }) {
  const i = ADIMLAR.indexOf(adim);
  return (
    <View style={{ flexDirection: 'row', marginBottom: 12 }}>
      {ADIMLAR.map((a, k) => (
        <View key={a} style={[st.adim, k <= i && { backgroundColor: colors.accent }]} />
      ))}
    </View>
  );
}

function Olustur({ onNext }) {
  return (
    <Card>
      <Title>1. YouTube'da kanalı oluştur</Title>
      <Dim style={st.p}>
        YouTube, kanal oluşturmaya sadece kendi sitesinden izin veriyor. Aşağıdaki düğme YouTube'u açar: kanalın olacağı
        Google hesabını seç, kanal adını yaz ve oluştur. Kanalın zaten varsa bu adımı geç.
      </Dim>
      <Button title="YouTube'da kanal oluştur" onPress={() => Linking.openURL('https://www.youtube.com/create_channel')} />
      <Dim style={st.p}>Özel küçük resim yükleyebilmek için kanalı telefonla da doğrula (bir kez):</Dim>
      <Button kind="secondary" title="Kanalı doğrula" onPress={() => Linking.openURL('https://www.youtube.com/verify')} />
      <Button title="Kanal hazır, devam" onPress={onNext} style={{ marginTop: 16 }} />
    </Card>
  );
}

function Bagla({ onConnected }) {
  const { options } = useSession();
  const [flow, setFlow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const signal = useRef({});
  useEffect(() => () => { signal.current.cancelled = true; }, []);

  const start = async () => {
    setError(null);
    setBusy(true);
    signal.current = {};
    try {
      const f = await startDeviceFlow();
      setFlow(f);
      Linking.openURL(f.url).catch(() => {});
      const tokens = await waitForApproval(f, signal.current);
      onConnected(await saveChannel(tokens, options.defaults));
    } catch (e) {
      setError(e.message);
      setFlow(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Title>2. Kanalı bağla</Title>
      <Dim style={st.p}>
        Düğmeye basınca bir kod çıkar ve Google'ın sayfası açılır. Kodu yaz, kanalın olduğu hesabı seç ve izin ver.
        "Google bu uygulamayı doğrulamadı" uyarısında Gelişmiş → devam et.
      </Dim>
      {flow ? (
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Text selectable style={st.kod}>{flow.userCode}</Text>
          <Dim>{flow.url}</Dim>
          <Button kind="secondary" title="Sayfayı yeniden aç" onPress={() => Linking.openURL(flow.url)} style={{ marginTop: 10 }} />
          <Dim style={{ marginTop: 10 }}>Onay bekleniyor…</Dim>
        </View>
      ) : null}
      {error ? <Text style={{ color: colors.err, marginVertical: 8 }}>{error}</Text> : null}
      {!flow ? <Button title="Kod al ve bağla" onPress={start} loading={busy} /> : null}
    </Card>
  );
}

async function avatarPaylas(base64) {
  const file = new File(Paths.cache, 'kanal-profil.jpg');
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', dialogTitle: 'Profil fotoğrafını kaydet' });
}

function Kimlik({ kanal, onNext }) {
  const [ch, setCh] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'channels', kanal), (s) => {
    const data = s.data();
    setCh(data);
    setForm((f) => f ?? {
      aciklama: data?.settings?.kurulum?.aciklama ?? '', anahtarKelimeler: data?.settings?.kurulum?.anahtarKelimeler ?? '',
      slogan: data?.settings?.kurulum?.slogan ?? '', ulke: data?.settings?.kurulum?.ulke ?? 'TR', banner: true,
    });
  }), [kanal]);
  if (!ch || !form) return null;
  const sonuc = ch.kurulumSonuc;
  const bekliyor = ch.settings?.kurulum?.istek && ch.settings.kurulum.istek !== sonuc?.istek;
  const set = (patch) => setForm({ ...form, ...patch });
  const kaydet = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'channels', kanal), { 'settings.kurulum': { ...form, istek: Date.now() } });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <Title>3. Kanal kimliği — {ch.title}</Title>
      <Dim style={st.p}>
        Bunlar YouTube'a yazılır; banner kanalın tarzında otomatik çizilir. Kanal adını ve profil fotoğrafını YouTube
        API değiştirmeye izin vermez: profil fotoğrafı burada hazırlanır, YouTube Studio'dan sen yüklersin.
      </Dim>
      <Label hint="İzleyicinin kanal sayfasında okuyacağı tanıtım (en fazla 1000 karakter).">Kanal açıklaması</Label>
      <TextInput value={form.aciklama} onChangeText={(aciklama) => set({ aciklama })} multiline maxLength={1000}
        placeholderTextColor={colors.dim} placeholder="Bu kanalda…" style={[st.input, { minHeight: 100 }]} />
      <Label hint="Virgülle ayır: tarih, osmanlı, icatlar">Anahtar kelimeler</Label>
      <TextInput value={form.anahtarKelimeler} onChangeText={(anahtarKelimeler) => set({ anahtarKelimeler })}
        placeholderTextColor={colors.dim} placeholder="tarih, belgesel" style={st.input} />
      <Label hint="Banner'da kanal adının altında durur.">Slogan</Label>
      <TextInput value={form.slogan} onChangeText={(slogan) => set({ slogan })} maxLength={60}
        placeholderTextColor={colors.dim} placeholder="merak ettiğiniz her şeyin hikayesi" style={st.input} />
      <Label>Ülke</Label>
      <ChoiceChips items={ULKELER} value={form.ulke} onChange={(ulke) => set({ ulke })} />
      <ChoiceChips items={[{ id: 1, label: 'Banner üret ve yükle' }, { id: 0, label: "Banner'a dokunma" }]}
        value={form.banner ? 1 : 0} onChange={(v) => set({ banner: Boolean(v) })} />
      <Button title="YouTube'a uygula" onPress={kaydet} loading={saving} disabled={bekliyor} style={{ marginTop: 14 }} />
      {bekliyor ? <Dim style={st.p}>Sırada: sistem bir saat içinde YouTube'a uygular ve sonucu burada gösterir.</Dim> : null}
      {sonuc && !bekliyor ? (
        <Text style={{ color: sonuc.durum === 'tamam' ? colors.ok : colors.err, marginTop: 10 }}>{sonuc.mesaj}</Text>
      ) : null}
      {sonuc?.avatar ? (
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <Image source={{ uri: `data:image/jpeg;base64,${sonuc.avatar}` }} style={st.avatar} />
          <Button kind="secondary" title="Profil fotoğrafını kaydet / paylaş" onPress={() => avatarPaylas(sonuc.avatar)} style={{ marginTop: 10 }} />
          <Button kind="secondary" title="YouTube Studio'da profil fotoğrafını değiştir"
            onPress={() => Linking.openURL('https://studio.youtube.com/channel/editing/images')} style={{ marginTop: 8 }} />
        </View>
      ) : null}
      <Button title="Devam: içerik ayarları" onPress={onNext} style={{ marginTop: 16 }} />
    </Card>
  );
}

export default function Kurulum() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [adim, setAdim] = useState(params.adim ?? 'olustur');
  const [kanal, setKanal] = useState(params.kanal ?? null);
  const [mesaj, setMesaj] = useState(null);
  const tekAdim = Boolean(params.adim);

  return (
    <Screen>
      <Stack.Screen options={{ title: BASLIK[adim] }} />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {!tekAdim ? <Adimlar adim={adim} /> : null}
        {mesaj ? <Card><Text style={{ color: colors.ok }}>{mesaj}</Text></Card> : null}
        {adim === 'olustur' ? <Olustur onNext={() => setAdim('bagla')} /> : null}
        {adim === 'bagla' ? (
          <Bagla onConnected={(c) => {
            setKanal(c.id);
            setMesaj(`"${c.title}" ${c.isNew ? 'bağlandı' : 'yeniden bağlandı'}.`);
            if (tekAdim) router.back(); else setAdim('kimlik');
          }} />
        ) : null}
        {adim === 'kimlik' && kanal ? <Kimlik kanal={kanal} onNext={() => router.replace(`/channel/${kanal}`)} /> : null}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  p: { marginVertical: 10, lineHeight: 20 },
  adim: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border, marginHorizontal: 3 },
  kod: { color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: 4, fontFamily: 'monospace' },
  input: { backgroundColor: colors.bg, color: colors.text, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, textAlignVertical: 'top' },
  avatar: { width: 140, height: 140, borderRadius: 70 },
});
