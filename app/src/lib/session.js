import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import defaultOptions from './options.default.json';

const SessionContext = createContext(null);

// Giriş durumu, yönetici yetkisi ve seçenek listesini tüm ekranlara sağlar.
export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [options, setOptions] = useState(defaultOptions);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (u) {
      const adminDoc = await getDoc(doc(db, 'admins', u.uid)).catch(() => null);
      setIsAdmin(Boolean(adminDoc?.exists()));
    } else {
      setIsAdmin(false);
    }
    setUser(u);
  }), []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    // Motor her senkronizasyonda güncel seçenekleri buraya yazar; yoksa uygulamadaki kopya kullanılır.
    return onSnapshot(doc(db, 'meta', 'options'), (snap) => {
      const json = snap.data()?.json;
      if (json) setOptions(JSON.parse(json));
    }, () => {});
  }, [isAdmin]);

  return (
    <SessionContext.Provider value={{ user, isAdmin, options, loading: user === undefined }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
