import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Telefonun bildirim adresini Firestore'a kaydeder; motor yükleme/hata bildirimlerini buraya yollar.
export async function registerForPush() {
  // Expo Go push bildirimini desteklemiyor; sadece APK'da kaydol.
  const inExpoGo = Constants.executionEnvironment === 'storeClient';
  if (Platform.OS !== 'android' || !Device.isDevice || inExpoGo) return null;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Video durumu',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF5A5F',
  });
  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await setDoc(doc(db, 'devices', token.replace(/[^\w-]/g, '_')), {
    expoPushToken: token,
    model: Device.modelName ?? null,
    updatedAt: new Date(),
  });
  return token;
}
