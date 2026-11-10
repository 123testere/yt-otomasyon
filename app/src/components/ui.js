import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export const colors = {
  bg: '#0A0B10',
  card: '#13151D',
  cardHi: '#1C1F2B',
  border: '#242838',
  text: '#F4F5FA',
  dim: '#8E95A8',
  accent: '#7C5CFF',
  accent2: '#22D3EE',
  ok: '#34D399',
  warn: '#FBBF24',
  err: '#F87171',
};

// Platform renkleri ve kısa adları
export const PLATFORM = {
  yt: { ad: 'YouTube', renk: '#FF3B30', ikon: '▶' },
  ig: { ad: 'Instagram', renk: '#E1306C', ikon: '◎' },
  tt: { ad: 'TikTok', renk: '#25F4EE', ikon: '♪' },
  fb: { ad: 'Facebook', renk: '#1877F2', ikon: 'f' },
};

export const sayi = (n) => (n == null ? '—' : n >= 10000 ? `${(n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B` : Math.round(n).toLocaleString('tr-TR'));

// Büyük gösterge kutusu
export function Kpi({ etiket, deger, alt, renk = colors.text, style }) {
  return (
    <View style={[s.kpi, style]}>
      <Text style={[s.kpiDeger, { color: renk }]} numberOfLines={1}>{deger}</Text>
      <Text style={s.kpiEtiket} numberOfLines={1}>{etiket}</Text>
      {alt ? <Text style={s.kpiAlt} numberOfLines={1}>{alt}</Text> : null}
    </View>
  );
}

// Basit çubuk grafik (son günler vb.)
export function Bars({ veri = [], renk = colors.accent, yukseklik = 56, vurguSon = true }) {
  const max = Math.max(1, ...veri.map((v) => v ?? 0));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: yukseklik, gap: 2 }}>
      {veri.map((v, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(2, ((v ?? 0) / max) * yukseklik), borderRadius: 3,
          backgroundColor: renk, opacity: vurguSon && i === veri.length - 1 ? 1 : 0.55 }} />
      ))}
    </View>
  );
}

// 24 saatlik dağılım (izleyicilerin aktif olduğu / rakiplerin yayın yaptığı saatler)
export function Heat24({ veri, renk = colors.accent2, etiket }) {
  if (!veri?.length) return null;
  const max = Math.max(1, ...veri);
  const enIyi = veri.indexOf(max);
  return (
    <View style={{ marginTop: 6 }}>
      {etiket ? <Text style={s.kpiEtiket}>{etiket} · en yoğun {String(enIyi).padStart(2, '0')}:00</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 2, marginTop: 6 }}>
        {veri.map((v, h) => (
          <View key={h} style={{ flex: 1, height: Math.max(3, (v / max) * 48), borderRadius: 2, backgroundColor: renk, opacity: 0.25 + 0.75 * (v / max) }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        {['00', '06', '12', '18', '23'].map((x) => <Text key={x} style={s.kpiAlt}>{x}</Text>)}
      </View>
    </View>
  );
}

export function Section({ children, sag }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionText}>{children}</Text>
      {sag ?? null}
    </View>
  );
}

export function Pill({ label, renk = colors.accent, dolu }) {
  return (
    <View style={[s.pill, { borderColor: renk, backgroundColor: dolu ? renk : 'transparent' }]}>
      <Text style={{ color: dolu ? colors.bg : renk, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

export function PlatformBadge({ p, aktif = true }) {
  const x = PLATFORM[p];
  return (
    <View style={[s.pbadge, { backgroundColor: aktif ? x.renk : colors.cardHi }]}>
      <Text style={{ color: aktif ? '#fff' : colors.dim, fontSize: 11, fontWeight: '900' }}>{x.ikon}</Text>
    </View>
  );
}

export function Screen({ children, style }) {
  return <View style={[s.screen, style]}>{children}</View>;
}

export function Card({ children, style, onPress }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { backgroundColor: colors.cardHi }, style]}>
      {children}
    </Pressable>
  );
}

export function Title({ children, style }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function Label({ children, hint }) {
  return (
    <View style={{ marginTop: 14, marginBottom: 8 }}>
      <Text style={s.label}>{children}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Dim({ children, style }) {
  return <Text style={[s.dim, style]}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, style }) {
  const bg = kind === 'primary' ? colors.accent : colors.cardHi;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={s.buttonText}>{title}</Text>}
    </Pressable>
  );
}

function Chip({ label, active, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.chip, active && s.chipActive, disabled && !active && { opacity: 0.35 }]}>
      <Text style={[s.chipText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

// Tek seçim: seçeneklerden birine dokununca o seçilir. disabled iken sadece seçili olan okunur görünür.
export function ChoiceChips({ items, value, onChange, disabled }) {
  return (
    <View style={s.chips}>
      {items.map((it) => (
        <Chip key={String(it.id)} label={it.label} active={String(it.id) === String(value)}
          disabled={disabled} onPress={() => onChange(it.id)} />
      ))}
    </View>
  );
}

// Çoklu seçim; max verilirse en fazla o kadar seçilebilir.
export function MultiChips({ items, values, onChange, max }) {
  const toggle = (id) => {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else if (!max || values.length < max) onChange([...values, id]);
  };
  return (
    <View style={s.chips}>
      {items.map((it) => (
        <Chip key={String(it.id)} label={it.label} active={values.includes(it.id)} onPress={() => toggle(it.id)} />
      ))}
    </View>
  );
}

export function Toggle({ label, value, onChange }) {
  return (
    <View style={s.toggle}>
      <Text style={[s.label, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.text} />
    </View>
  );
}

export function Field({ value, onChangeText, placeholder, multiline, secure, keyboardType, autoCapitalize = 'sentences', editable = true }) {
  return (
    <TextInput
      value={value}
      editable={editable}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.dim}
      multiline={multiline}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={[s.input, multiline && { minHeight: 90, textAlignVertical: 'top' }, !editable && { opacity: 0.5 }]}
    />
  );
}

const STATUS = {
  rendering: { label: 'Hazırlanıyor', color: colors.warn },
  uploading: { label: 'Yükleniyor', color: colors.warn },
  uploaded: { label: 'Yüklendi', color: colors.ok },
  error: { label: 'Hata', color: colors.err },
  invalid: { label: 'Geçersiz senaryo', color: colors.err },
  paused: { label: 'Kanal kapalı', color: colors.dim },
  'waiting-quota': { label: 'Kota bekliyor', color: colors.warn },
};

export function StatusBadge({ status }) {
  const st = STATUS[status] ?? { label: status ?? '—', color: colors.dim };
  return (
    <View style={[s.badge, { borderColor: st.color }]}>
      <Text style={{ color: st.color, fontSize: 12, fontWeight: '600' }}>{st.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  kpi: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  kpiDeger: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiEtiket: { color: colors.dim, fontSize: 12, fontWeight: '600', marginTop: 2 },
  kpiAlt: { color: colors.dim, fontSize: 10, marginTop: 2 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  sectionText: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pbadge: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.dim, fontSize: 12, marginTop: 2 },
  dim: { color: colors.dim, fontSize: 13 },
  button: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
});
