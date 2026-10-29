// Uygulamaya giriş yapabilecek hesabı yönetici yapar: npm run yonetici-yap -- ornek@gmail.com
import { auth, db } from './lib/firebase.js';

const email = process.argv[2];
if (!email) {
  console.error('Kullanım: npm run yonetici-yap -- <e-posta>');
  process.exit(1);
}

const user = await auth().getUserByEmail(email).catch(() => null);
if (!user) {
  console.error(`${email} ile kayıtlı kullanıcı yok. Önce uygulamada bu e-postayla hesap oluştur.`);
  process.exit(1);
}
await db().doc(`admins/${user.uid}`).set({ email, createdAt: new Date() });
console.log(`✓ ${email} artık yönetici.`);
process.exit(0);
