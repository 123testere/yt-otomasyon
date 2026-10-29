import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export const colors = {
  bg: '#0E1015',
  card: '#171A22',
  cardHi: '#1F2330',
  border: '#2A2F3D',
  text: '#F2F4F8',
  dim: '#9AA3B5',
  accent: '#FF5A5F',
  ok: '#3DDC97',
  warn: '#FFB547',
  err: '#FF6B6B',
};

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
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.dim, fontSize: 12, marginTop: 2 },
  dim: { color: colors.dim, fontSize: 13 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
});
