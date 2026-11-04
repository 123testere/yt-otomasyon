import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { Button, Card, ChoiceChips, colors, Dim, Field, Label, MultiChips, Screen, Toggle } from '../../components/ui';

function withDefaults(settings, defaults) {
  return {
    ...defaults,
    ...settings,
    long: { ...defaults.long, ...(settings?.long ?? {}) },
    shorts: { ...defaults.shorts, ...(settings?.shorts ?? {}) },
  };
}

function Section({ title, children }) {
  return (
    <Card>
      <Text style={st.section}>{title}</Text>
      {children}
    </Card>
  );
}

export default function ChannelSettings() {
  const { id } = useLocalSearchParams();
  const { options } = useSession();
  const router = useRouter();
  const [channel, setChannel] = useState(null);
  const [s, setS] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portrait, setPortrait] = useState(null);
  // Sadece bu ekranda değiştirilen ayarlar kaydedilir; açık kalmış eski bir form diğer ayarları ezmesin.
  const [changed, setChanged] = useState(() => new Set());

  useEffect(() => onSnapshot(doc(db, 'channels', id), (snap) => {
    const data = snap.data();
    setChannel(data);
    // Kaydedilmemiş değişiklik varken uzaktan gelen güncelleme formu ezmesin.
    setS((cur) => (cur && dirty ? cur : withDefaults(data?.settings, options.defaults)));
  }), [id, dirty]);

  useEffect(() => onSnapshot(doc(db, 'characters', id), (snap) => setPortrait(snap.data() ?? null), () => {}), [id]);

  if (!s) return <Screen />;

  const set = (patch) => {
    setS((cur) => ({ ...cur, ...patch }));
    setChanged((cur) => new Set([...cur, ...Object.keys(patch)]));
    setDirty(true);
  };
  const setLong = (patch) => set({ long: { ...s.long, ...patch } });
  const setShorts = (patch) => set({ shorts: { ...s.shorts, ...patch } });

  const language = options.languages.find((l) => l.id === s.language) ?? options.languages[0];
  const niche = options.niches.find((n) => n.id === s.niche);
  const character = options.characters.find((c) => c.id === s.character);
  const timeItems = options.publishTimes.map((t) => ({ id: t, label: t }));
  const locked = Boolean(s.identityLocked);
  // Motor yüzü "karakter|tarif" anahtarıyla saklar; seçim değiştiyse eski yüzü gösterme.
  const expectedKey = character?.custom ? `ozel|${s.customCharacter}` : `${character?.id}|${character?.prompt}`;
  const portraitReady = Boolean(portrait?.image && portrait.key === expectedKey);

  const toggleLock = (value) => {
    if (value) return set({ identityLocked: true });
    Alert.alert(
      'Kilidi aç?',
      'Ses veya karakteri değiştirirsen yeni videolar eskilerden farklı görünür ve duyulur. İzleyiciler kanalı tanımakta zorlanabilir.',
      [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Kilidi aç', style: 'destructive', onPress: () => set({ identityLocked: false }) }],
    );
  };

  const save = async () => {
    if (niche?.custom && !s.customNiche.trim()) return Alert.alert('Eksik bilgi', 'Özel konu seçtin; konuyu yaz.');
    if (character?.custom && !s.customCharacter.trim()) return Alert.alert('Eksik bilgi', 'Özel karakter seçtin; karakteri tarif et.');
    setSaving(true);
    try {
      const updates = Object.fromEntries([...changed].map((key) => [`settings.${key}`, s[key]]));
      if (Object.keys(updates).length) await updateDoc(doc(db, 'channels', id), updates);
      setChanged(new Set());
      setDirty(false);
      router.back();
    } catch (e) {
      Alert.alert('Kaydedilemedi', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: channel?.title ?? 'Kanal ayarları' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card>
          <Toggle label="Otomasyon açık" value={s.enabled} onChange={(enabled) => set({ enabled })} />
          <Dim style={{ marginTop: 6 }}>Kapalıyken bu kanal için video üretilmez ve yüklenmez.</Dim>
        </Card>

        <Section title="İçerik">
          {options.contentFormats ? (
            <>
              <Label hint={options.contentFormats.find((f) => f.id === (s.contentFormat ?? 'belgesel'))?.hint}>İçerik formatı</Label>
              <ChoiceChips items={options.contentFormats} value={s.contentFormat ?? 'belgesel'} onChange={(contentFormat) => set({ contentFormat })} />
            </>
          ) : null}
          <Label>Kanal konusu</Label>
          <ChoiceChips items={options.niches} value={s.niche} onChange={(niche) => set({ niche })} />
          {niche?.custom ? (
            <View style={{ marginTop: 10 }}>
              <Field value={s.customNiche} onChangeText={(customNiche) => set({ customNiche })}
                placeholder="Örn: Osmanlı padişahlarının bilinmeyen alışkanlıkları" multiline />
            </View>
          ) : null}
          <Label hint={locked ? 'Ses kilitliyken dil değiştirilemez (ses dile bağlı).' : null}>Dil</Label>
          <ChoiceChips items={options.languages} value={s.language} disabled={locked}
            onChange={(lang) => set({ language: lang, voice: options.languages.find((l) => l.id === lang).voices[0].id })} />
          <Label hint={options.tones.find((t) => t.id === s.tone)?.hint}>Anlatım tonu</Label>
          <ChoiceChips items={options.tones} value={s.tone} onChange={(tone) => set({ tone })} />
          <Label hint="Claude senaryoyu yazarken buna uyar.">Ek talimat (isteğe bağlı)</Label>
          <Field value={s.extraInstructions} onChangeText={(extraInstructions) => set({ extraInstructions })}
            placeholder="Örn: Her videonun sonunda izleyiciye bir soru sor." multiline />
        </Section>

        <Card style={locked ? { borderColor: colors.ok } : null}>
          <Toggle label="Ses ve karakter sabit" value={locked} onChange={toggleLock} />
          <Dim style={{ marginTop: 6, lineHeight: 18 }}>
            {locked
              ? 'Kilitli: her videoda aynı ses ve aynı karakter kullanılır.'
              : 'İlk video yayınlanınca otomatik kilitlenir. Şimdi seçtiğin ses ve karakter kanalın kimliği olur.'}
          </Dim>
        </Card>

        <Section title="Ses">
          {options.voiceSources ? (
            <>
              <Label hint={options.voiceSources.find((v) => v.id === s.voiceSource)?.hint}>Ses kaynağı</Label>
              <ChoiceChips items={options.voiceSources} value={s.voiceSource} onChange={(voiceSource) => set({ voiceSource })} disabled={locked} />
            </>
          ) : null}
          {['klon', 'elevenlabs'].includes(s.voiceSource) && options.cloneScopes ? (
            <>
              <Label hint={options.cloneScopes.find((c) => c.id === s.cloneScope)?.hint}>Kendi sesim hangi videolarda?</Label>
              <ChoiceChips items={options.cloneScopes} value={s.cloneScope} onChange={(cloneScope) => set({ cloneScope })} />
            </>
          ) : null}
          {s.voiceSource === 'klon' ? (
            <Dim style={{ marginTop: 8, color: channel?.hasVoiceSample ? colors.ok : colors.warn }}>
              {channel?.hasVoiceSample
                ? 'Ses örneğin yüklü.'
                : 'Bu kanal için ses örneği yok. Yüklenene kadar hazır ses kullanılır.'}
            </Dim>
          ) : null}
          {s.voiceSource === 'elevenlabs' ? (
            <>
              <Label hint="ElevenLabs → Voices → sesin → ID. Kredi biterse video hazır sesle üretilir.">ElevenLabs ses kimliği</Label>
              <Field value={s.elevenVoiceId ?? ''} onChangeText={(elevenVoiceId) => set({ elevenVoiceId })}
                placeholder="ör. qLnVd55Hf2R5L8dmdHoH" autoCapitalize="none" editable={!locked} />
            </>
          ) : null}
          <Label hint={s.voiceSource === 'klon' ? 'Kendi sesin kullanılamadığında yedek olarak bu ses okunur.' : null}>Seslendirme sesi</Label>
          <ChoiceChips items={language.voices} value={s.voice} onChange={(voice) => set({ voice })} disabled={locked} />
          <Label hint="Bütün ses kaynaklarında uygulanır.">Konuşma hızı</Label>
          <ChoiceChips items={options.speechRates} value={s.speechRate} onChange={(speechRate) => set({ speechRate })} disabled={locked} />
          {options.voiceStyles && s.voiceSource !== 'hazir' ? (
            <>
              <Label hint={options.voiceStyles.find((v) => v.id === s.voiceStyle)?.hint ?? 'Kendi sesinin duygu yoğunluğu.'}>Ses ifadesi</Label>
              <ChoiceChips items={options.voiceStyles} value={s.voiceStyle ?? 'dengeli'} onChange={(voiceStyle) => set({ voiceStyle })} />
            </>
          ) : null}
          {options.voicePitches && (s.voiceSource ?? 'hazir') === 'hazir' ? (
            <>
              <Label hint="Sadece hazır seste geçerli.">Ses perdesi</Label>
              <ChoiceChips items={options.voicePitches} value={s.voicePitch ?? '+0Hz'} onChange={(voicePitch) => set({ voicePitch })} />
            </>
          ) : null}
        </Section>

        <Section title="Karakter">
          {character && character.id !== 'yok' ? (
            <View style={st.portraitRow}>
              {portraitReady ? (
                <Image source={{ uri: `data:image/jpeg;base64,${portrait.image}` }} style={st.portrait} />
              ) : (
                <View style={[st.portrait, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Dim style={{ textAlign: 'center', fontSize: 11 }}>Çiziliyor</Dim>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{character.label}</Text>
                <Dim style={{ marginTop: 4 }}>
                  {portraitReady
                    ? portrait.regenerate ? 'Yeni yüz en geç 1 saat içinde çizilecek.' : 'Her videoda bu yüz kullanılır.'
                    : 'Kaydettikten sonra en geç 1 saat içinde yüzü çizilir.'}
                </Dim>
                {portraitReady && !locked && !portrait.regenerate ? (
                  <Button kind="secondary" title="Yeni yüz çiz" style={{ marginTop: 8, paddingVertical: 8 }}
                    onPress={() => updateDoc(doc(db, 'characters', id), { regenerate: true })} />
                ) : null}
              </View>
            </View>
          ) : null}
          <Label hint={character?.persona}>Anlatıcı karakter</Label>
          <ChoiceChips items={options.characters} value={s.character} onChange={(c) => set({ character: c })} disabled={locked} />
          {character?.custom ? (
            <View style={{ marginTop: 10 }}>
              <Field value={s.customCharacter} onChangeText={(customCharacter) => set({ customCharacter })} editable={!locked}
                placeholder="Görünüşünü ve kişiliğini tarif et (ör: bıyıklı, fesli, esprili bir İstanbul beyefendisi)" multiline />
            </View>
          ) : null}
          {s.character !== 'yok' ? (
            <Toggle label="Karakter videoda görünsün" value={s.characterOnScreen}
              onChange={(characterOnScreen) => set({ characterOnScreen })} />
          ) : null}
        </Section>

        <Section title="Görsel">
          {options.templates ? (
            <>
              <Label hint={options.templates.find((t) => t.id === s.template)?.hint}>Video şablonu</Label>
              <ChoiceChips items={options.templates} value={s.template} onChange={(template) => set({ template })} />
            </>
          ) : null}
          <Label>Görsel stili</Label>
          <ChoiceChips items={options.visualStyles} value={s.visualStyle} onChange={(visualStyle) => set({ visualStyle })} />
        </Section>

        <Section title="Müzik ve altyazı">
          <Label hint="Seçilen türde telifsiz bir parça (Kevin MacLeod) otomatik eklenir; açıklamaya kaynak yazılır.">Arka plan müziği</Label>
          <ChoiceChips items={options.musicMoods} value={s.music} onChange={(music) => set({ music })} />
          {s.music !== 'yok' ? (
            <>
              <Label>Müzik sesi</Label>
              <ChoiceChips items={options.musicVolumes} value={s.musicVolume} onChange={(musicVolume) => set({ musicVolume })} />
            </>
          ) : null}
          <Label>Altyazı</Label>
          <ChoiceChips items={options.subtitleModes} value={s.subtitles} onChange={(subtitles) => set({ subtitles })} />
          {s.subtitles !== 'yok' ? (
            <>
              <Label>Altyazı rengi</Label>
              <ChoiceChips items={options.subtitleColors} value={s.subtitleColor} onChange={(subtitleColor) => set({ subtitleColor })} />
            </>
          ) : null}
        </Section>

        <Section title="Uzun video">
          <Label hint="Hiç gün seçmezsen uzun video üretilmez.">Yayın günleri</Label>
          <MultiChips items={options.weekdays} values={s.long.days} onChange={(days) => setLong({ days })} />
          <Label>Yayın saati</Label>
          <ChoiceChips items={timeItems} value={s.long.time} onChange={(time) => setLong({ time })} />
          <Label>Süre</Label>
          <ChoiceChips items={options.longMinutes} value={s.long.minutes} onChange={(minutes) => setLong({ minutes })} />
        </Section>

        <Section title="Shorts">
          <Label hint="Her seçtiğin saat günde bir Shorts demek (en fazla 3).">Yayın saatleri</Label>
          <MultiChips items={timeItems} values={s.shorts.times} onChange={(times) => setShorts({ times })} max={3} />
          <Label>Süre</Label>
          <ChoiceChips items={options.shortSeconds} value={s.shorts.seconds} onChange={(seconds) => setShorts({ seconds })} />
          {options.shortsSources ? (
            <>
              <Label hint="Kesit: haftanın uzun videosundan en fazla 3 Shorts; kalan günler bağımsız yazılır.">Shorts kaynağı</Label>
              <ChoiceChips items={options.shortsSources} value={s.shorts.source ?? 'bagimsiz'} onChange={(source) => setShorts({ source })} />
            </>
          ) : null}
        </Section>

        <Section title="Yayın">
          <Label>Görünürlük</Label>
          <ChoiceChips items={options.privacies} value={s.privacy} onChange={(privacy) => set({ privacy })} />
          <Toggle label="Yapay zekâ içeriği olarak işaretle" value={s.aiDisclosure}
            onChange={(aiDisclosure) => set({ aiDisclosure })} />
          <Dim style={{ marginTop: 4 }}>Gerçekçi YZ görselleri kullanıyorsan YouTube kuralları gereği açık kalmalı.</Dim>
          <Label hint="Her açıklamanın sonuna eklenir.">Sabit hashtag'ler</Label>
          <Field value={s.hashtags} onChangeText={(hashtags) => set({ hashtags })} placeholder="#tarih #belgesel" autoCapitalize="none" />
        </Section>
      </ScrollView>

      <View style={st.footer}>
        <Button title={dirty ? 'Kaydet' : 'Kaydedildi'} onPress={save} loading={saving} disabled={!dirty} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  section: { color: colors.text, fontSize: 17, fontWeight: '800' },
  portraitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  portrait: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.cardHi, borderWidth: 3, borderColor: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
