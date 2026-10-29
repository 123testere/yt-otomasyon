import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase web yapılandırması gizli değildir; erişimi firestore.rules korur.
const firebaseConfig = {
  apiKey: 'AIzaSyCmNNblg1Iarql9li5Db42K_Zub0ArZ9PA',
  authDomain: 'yt-otomasyon-dk25.firebaseapp.com',
  projectId: 'yt-otomasyon-dk25',
  storageBucket: 'yt-otomasyon-dk25.firebasestorage.app',
  messagingSenderId: '844852318279',
  appId: '1:844852318279:web:cee42c1e064cf0e9d32162',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
export const db = getFirestore(app);
