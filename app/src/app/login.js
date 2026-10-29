import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button, colors, Dim, Field, Screen } from '../components/ui';

const MESSAGES = {
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/email-already-in-use': 'Bu e-postayla zaten hesap var, giriş yap.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/invalid-email': 'E-posta adresi geçersiz.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const fn = mode === 'login' ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
      await fn(auth, email.trim(), password);
    } catch (e) {
      setError(MESSAGES[e.code] ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={st.wrap}>
        <Text style={st.logo}>YT Otomasyon</Text>
        <Dim style={{ marginBottom: 28 }}>Kanallarını telefondan yönet.</Dim>
        <Field value={email} onChangeText={setEmail} placeholder="E-posta" keyboardType="email-address" autoCapitalize="none" />
        <View style={{ height: 10 }} />
        <Field value={password} onChangeText={setPassword} placeholder="Şifre" secure autoCapitalize="none" />
        {error ? <Text style={st.error}>{error}</Text> : null}
        <Button title={mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} onPress={submit} loading={busy} style={{ marginTop: 20 }} />
        <Button
          kind="secondary"
          title={mode === 'login' ? 'İlk kez mi? Hesap oluştur' : 'Hesabım var, giriş yap'}
          onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{ marginTop: 10 }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: 6 },
  error: { color: colors.err, marginTop: 12 },
});
